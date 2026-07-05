import { randomUUID } from "node:crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { resolveAgentPrompts, type AgentKey } from "../lib/agent-prompts-store";
import {
  runBuySellAgent,
  runDataAnalysis,
  runFeedbackAgent,
  runReportAgent,
} from "./agents";
import { buildMarketDataProvider } from "./market-data";
import { getOpenAiRuntimeSummary } from "../lib/openai";
import { isExperimentLiveOrderEnabled } from "../lib/runtime-config";
import { supportsLiveBrokerSubmission } from "../lib/broker-config";
import type {
  AnalysisSignal,
  InvestmentMandate,
  InvestmentReport,
  InvestmentRequest,
  MandateViolation,
  MarketData,
  SupervisorDirective,
  TradeDecision,
  WorkflowFeedback,
  WorkflowResult,
} from "./schemas";

const COMPANY_SYMBOL_ALIASES: Record<string, string> = {
  apple: "AAPL",
  애플: "AAPL",
  microsoft: "MSFT",
  마이크로소프트: "MSFT",
  tesla: "TSLA",
  테슬라: "TSLA",
  nvidia: "NVDA",
  엔비디아: "NVDA",
  amazon: "AMZN",
  아마존: "AMZN",
  alphabet: "GOOGL",
  google: "GOOGL",
  구글: "GOOGL",
  meta: "META",
  메타: "META",
  netflix: "NFLX",
  넷플릭스: "NFLX",
  삼성: "005930",
  "삼성전자": "005930",
  네이버: "035420",
};

const TICKER_PATTERN = /\b[A-Z]{1,5}\b/g;
const TICKER_STOP_WORDS = new Set(["BUY", "SELL", "HOLD", "LONG", "SHORT"]);
const MAX_COLLECTION_ATTEMPTS = 2;
const MAX_ANALYSIS_ATTEMPTS = 2;
const WORKFLOW_RECURSION_LIMIT = 32;

type PromptMap = Record<AgentKey, string>;

const WorkflowGraphAnnotation = Annotation.Root({
  request: Annotation<InvestmentRequest>(),
  mandate: Annotation<InvestmentMandate>(),
  directive: Annotation<SupervisorDirective | null>(),
  prompts: Annotation<PromptMap | null>(),
  resolved_symbols: Annotation<string[]>(),
  market_data: Annotation<MarketData[]>(),
  analysis_signals: Annotation<AnalysisSignal[]>(),
  investment_reports: Annotation<InvestmentReport[]>(),
  decisions: Annotation<TradeDecision[]>(),
  feedback: Annotation<WorkflowFeedback | null>(),
  mandate_violations: Annotation<MandateViolation[]>(),
  collection_attempts: Annotation<number>(),
  analysis_attempts: Annotation<number>(),
  pending_collection_retry: Annotation<boolean>(),
  pending_analysis_retry: Annotation<boolean>(),
});

type WorkflowGraphState = typeof WorkflowGraphAnnotation.State;

type WorkflowGraphStateInput = {
  request: InvestmentRequest;
  mandate: InvestmentMandate;
  directive: SupervisorDirective | null;
  prompts: PromptMap | null;
  resolved_symbols: string[];
  market_data: MarketData[];
  analysis_signals: AnalysisSignal[];
  investment_reports: InvestmentReport[];
  decisions: TradeDecision[];
  feedback: WorkflowFeedback | null;
  mandate_violations: MandateViolation[];
  collection_attempts: number;
  analysis_attempts: number;
  pending_collection_retry: boolean;
  pending_analysis_retry: boolean;
};

type WorkflowNodeName =
  | "data_collection"
  | "data_analysis"
  | "report"
  | "buy_sell"
  | "feedback_review"
  | typeof END;

function extractSymbols(...texts: string[]): string[] {
  const extracted: string[] = [];
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const [alias, symbol] of Object.entries(COMPANY_SYMBOL_ALIASES)) {
      if (lower.includes(alias)) {
        extracted.push(symbol);
      }
    }
    const tickers = text.match(TICKER_PATTERN) ?? [];
    extracted.push(...tickers.filter((ticker) => !TICKER_STOP_WORDS.has(ticker)));
  }
  return mergeSymbols(extracted);
}

function mergeSymbols(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const symbol of group) {
      const normalized = symbol.trim().toUpperCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
  }
  return result;
}

function buildSupervisorDirective(request: InvestmentRequest, mandate: InvestmentMandate): SupervisorDirective {
  const objective = request.user_prompt.trim() || mandate.objective;
  const mentionedSymbols = extractSymbols(request.user_prompt, ...request.chat_messages);
  const requestedSymbols = mergeSymbols(request.symbols);
  const focusSymbols = mergeSymbols(requestedSymbols, mentionedSymbols);
  const requestedSymbolSet = new Set(requestedSymbols);
  const watchSymbols = mentionedSymbols.filter((symbol) => !requestedSymbolSet.has(symbol));
  const guidance = request.chat_messages.map((m) => m.trim()).filter(Boolean);

  const summaryParts: string[] = [];
  if (objective) summaryParts.push(`objective=${objective}`);
  if (watchSymbols.length > 0) summaryParts.push(`watch=${watchSymbols.join(", ")}`);
  else if (focusSymbols.length > 0) summaryParts.push(`focus=${focusSymbols.join(", ")}`);

  return {
    objective,
    focus_symbols: focusSymbols,
    watch_symbols: watchSymbols,
    guidance,
    summary: summaryParts.join("; "),
  };
}

function checkMandateViolations(symbols: string[], mandate: InvestmentMandate): MandateViolation[] {
  const violations: MandateViolation[] = [];
  const allowedSymbols = new Set(mergeSymbols(mandate.allowed_symbols));
  const excludedSymbols = new Set(mergeSymbols(mandate.excluded_symbols));
  for (const symbol of symbols) {
    if (allowedSymbols.size > 0 && !allowedSymbols.has(symbol)) {
      violations.push({
        symbol,
        rule: "allowed_symbols",
        message: `${symbol} is not in the mandate allowed_symbols list.`,
      });
    }
    if (excludedSymbols.has(symbol)) {
      violations.push({
        symbol,
        rule: "excluded_symbols",
        message: `${symbol} is explicitly excluded by the mandate.`,
      });
    }
  }
  return violations;
}

function applyMandateToReports(
  reports: InvestmentReport[],
  violations: MandateViolation[],
): InvestmentReport[] {
  const violationsBySymbol = new Map<string, MandateViolation[]>();
  for (const violation of violations) {
    const symbolViolations = violationsBySymbol.get(violation.symbol) ?? [];
    symbolViolations.push(violation);
    violationsBySymbol.set(violation.symbol, symbolViolations);
  }

  return reports.map((report) => {
    const symbolViolations = violationsBySymbol.get(report.symbol) ?? [];
    if (symbolViolations.length === 0) {
      return report;
    }

    const violationMessages = symbolViolations.map((violation) => violation.message);
    const summary = report.summary.includes("mandate=")
      ? report.summary
      : `${report.summary}; mandate=${violationMessages[0]}`;

    return {
      ...report,
      summary,
      risk_flags: [...report.risk_flags.filter((flag) => flag !== "risk rules passed"), ...violationMessages],
      risk_approved: false,
      recommended_action_bias: "HOLD" as const,
      rationale: `${report.rationale} Mandate blocked execution: ${violationMessages.join("; ")}`,
    };
  });
}

function buildDefaultMandate(request: InvestmentRequest): InvestmentMandate {
  return request.mandate ?? {
    objective: request.user_prompt.trim() || "Evaluate requested equity symbols conservatively.",
    allowed_symbols: [],
    excluded_symbols: [],
    max_position_weight: request.max_position_weight,
    max_order_notional: null,
    min_cash_weight: null,
    risk_tolerance: "medium",
    requires_approval_for_live_orders: true,
    user_notes: "",
  };
}

const provider = buildMarketDataProvider();

function mainAgentNode(state: WorkflowGraphState): WorkflowGraphState {
  const directive = state.directive ?? buildSupervisorDirective(state.request, state.mandate);
  const prompts = state.prompts ?? resolveAgentPrompts(state.request.prompt_overrides);
  const resolvedSymbols =
    directive.focus_symbols.length > 0 ? directive.focus_symbols : state.request.symbols;

  return {
    ...state,
    directive,
    prompts,
    resolved_symbols: resolvedSymbols,
  };
}

async function dataCollectionNode(state: WorkflowGraphState): Promise<WorkflowGraphState> {
  const marketData = await Promise.all(
    state.resolved_symbols.map((symbol) => Promise.resolve(provider.getMarketData(symbol))),
  );
  return {
    ...state,
    market_data: marketData,
    analysis_signals: [],
    investment_reports: [],
    decisions: [],
    feedback: null,
    pending_collection_retry: false,
    pending_analysis_retry: false,
    collection_attempts: state.collection_attempts + 1,
  };
}

async function dataAnalysisNode(state: WorkflowGraphState): Promise<WorkflowGraphState> {
  const prompts = state.prompts;
  if (!prompts) {
    throw new Error("workflow prompts are not initialized");
  }

  return {
    ...state,
    analysis_signals: await runDataAnalysis(state.market_data, prompts.data_analysis),
    investment_reports: [],
    decisions: [],
    feedback: null,
    pending_analysis_retry: false,
    analysis_attempts: state.analysis_attempts + 1,
  };
}

async function reportNode(state: WorkflowGraphState): Promise<WorkflowGraphState> {
  const prompts = state.prompts;
  if (!prompts) {
    throw new Error("workflow prompts are not initialized");
  }

  const resolvedRequest: InvestmentRequest = {
    ...state.request,
    mandate: state.mandate,
    symbols: state.resolved_symbols,
  };

  const mandateViolations = checkMandateViolations(state.resolved_symbols, state.mandate);
  const reports = await runReportAgent(
    resolvedRequest,
    state.market_data,
    state.analysis_signals,
    prompts.report,
  );

  return {
    ...state,
    mandate_violations: mandateViolations,
    investment_reports: applyMandateToReports(reports, mandateViolations),
    decisions: [],
    feedback: null,
  };
}

async function buySellNode(state: WorkflowGraphState): Promise<WorkflowGraphState> {
  const prompts = state.prompts;
  if (!prompts) {
    throw new Error("workflow prompts are not initialized");
  }

  return {
    ...state,
    decisions: await runBuySellAgent(state.investment_reports, prompts.buy_sell),
    feedback: null,
  };
}

async function feedbackNode(state: WorkflowGraphState): Promise<WorkflowGraphState> {
  const prompts = state.prompts;
  if (!prompts) {
    throw new Error("workflow prompts are not initialized");
  }

  const feedback = await runFeedbackAgent(
    state.decisions,
    state.investment_reports,
    state.market_data,
    state.mandate_violations,
    prompts,
  );

  const collectionRetry =
    feedback.collection_feedback.length > 0 && state.collection_attempts < MAX_COLLECTION_ATTEMPTS;
  const analysisRetry =
    !collectionRetry &&
    feedback.analysis_feedback.length > 0 &&
    state.analysis_attempts < MAX_ANALYSIS_ATTEMPTS;

  return {
    ...state,
    feedback: {
      ...feedback,
      summary:
        `${feedback.summary}; collection_attempts=${state.collection_attempts}; ` +
        `analysis_attempts=${state.analysis_attempts}`,
    },
    pending_collection_retry: collectionRetry,
    pending_analysis_retry: analysisRetry,
  };
}

function routeFromMainAgent(state: WorkflowGraphState): WorkflowNodeName {
  if (state.pending_collection_retry || state.market_data.length === 0) {
    return "data_collection";
  }
  if (state.pending_analysis_retry || state.analysis_signals.length === 0) {
    return "data_analysis";
  }
  if (state.investment_reports.length === 0) {
    return "report";
  }
  if (state.decisions.length === 0) {
    return "buy_sell";
  }
  if (state.feedback === null) {
    return "feedback_review";
  }
  return END;
}

const workflowGraph = new StateGraph(WorkflowGraphAnnotation)
  .addNode("main_agent", mainAgentNode)
  .addNode("data_collection", dataCollectionNode)
  .addNode("data_analysis", dataAnalysisNode)
  .addNode("report", reportNode)
  .addNode("buy_sell", buySellNode)
  .addNode("feedback_review", feedbackNode)
  .addEdge(START, "main_agent")
  .addConditionalEdges("main_agent", routeFromMainAgent, [
    "data_collection",
    "data_analysis",
    "report",
    "buy_sell",
    "feedback_review",
    END,
  ])
  .addEdge("data_collection", "main_agent")
  .addEdge("data_analysis", "main_agent")
  .addEdge("report", "main_agent")
  .addEdge("buy_sell", "main_agent")
  .addEdge("feedback_review", "main_agent")
  .compile({ name: "investment-workflow" });

export async function runWorkflowGraph(request: InvestmentRequest): Promise<WorkflowResult> {
  const mandate = buildDefaultMandate(request);
  const finalState = await workflowGraph.invoke(
    {
      request,
      mandate,
      directive: null,
      prompts: null,
      resolved_symbols: [],
      market_data: [],
      analysis_signals: [],
      investment_reports: [],
      decisions: [],
      feedback: null,
      mandate_violations: [],
      collection_attempts: 0,
      analysis_attempts: 0,
      pending_collection_retry: false,
      pending_analysis_retry: false,
    } satisfies WorkflowGraphStateInput,
    { recursionLimit: WORKFLOW_RECURSION_LIMIT },
  );

  if (!finalState.directive || !finalState.prompts || !finalState.feedback) {
    throw new Error("workflow graph did not produce a complete final state");
  }

  return {
    run_id: `run-${randomUUID()}`,
    created_at: new Date().toISOString(),
    symbols: finalState.resolved_symbols,
    user_prompt: request.user_prompt,
    chat_messages: request.chat_messages,
    runtime: {
      data_mode: provider.mode_name,
      ...getOpenAiRuntimeSummary(),
      live_order_enabled: supportsLiveBrokerSubmission() && isExperimentLiveOrderEnabled(),
    },
    mandate: finalState.mandate,
    supervisor_directive: finalState.directive,
    market_data: finalState.market_data,
    analysis_signals: finalState.analysis_signals,
    investment_reports: finalState.investment_reports,
    decisions: finalState.decisions,
    feedback: finalState.feedback,
    mandate_violations: finalState.mandate_violations,
  };
}
