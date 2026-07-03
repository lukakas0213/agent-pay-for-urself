import { resolveAgentPrompts } from "../lib/agent-prompts-store";
import { StubMarketDataProvider } from "./market-data";
import {
  runBuySellAgent,
  runDataAnalysis,
  runLogEvaluationAgent,
  runOrderExecutionAgent,
  runReportAgent,
} from "./agents";
import type {
  InvestmentMandate,
  InvestmentRequest,
  MandateViolation,
  SupervisorDirective,
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
    extracted.push(...tickers);
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
  const focusSymbols = mergeSymbols(request.symbols, mentionedSymbols);
  const watchSymbols = mentionedSymbols.filter((s) => !request.symbols.includes(s));
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

function checkMandateViolations(
  symbols: string[],
  mandate: InvestmentMandate,
): MandateViolation[] {
  const violations: MandateViolation[] = [];
  for (const symbol of symbols) {
    if (
      mandate.allowed_symbols.length > 0 &&
      !mandate.allowed_symbols.includes(symbol)
    ) {
      violations.push({
        symbol,
        rule: "allowed_symbols",
        message: `${symbol} is not in the mandate allowed_symbols list.`,
      });
    }
    if (mandate.excluded_symbols.includes(symbol)) {
      violations.push({
        symbol,
        rule: "excluded_symbols",
        message: `${symbol} is explicitly excluded by the mandate.`,
      });
    }
  }
  return violations;
}

const provider = new StubMarketDataProvider();

export function runWorkflow(request: InvestmentRequest): WorkflowResult {
  const mandate: InvestmentMandate = request.mandate ?? {
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

  const directive = buildSupervisorDirective(request, mandate);
  const prompts = resolveAgentPrompts(request.prompt_overrides);

  const resolvedRequest: InvestmentRequest = {
    ...request,
    symbols: directive.focus_symbols.length > 0 ? directive.focus_symbols : request.symbols,
  };

  const marketData = resolvedRequest.symbols.map((symbol) =>
    provider.getMarketData(symbol),
  );

  const analysisSignals = runDataAnalysis(marketData, prompts.data_analysis);

  const mandateViolations = checkMandateViolations(resolvedRequest.symbols, mandate);
  const violationsBySymbol = new Map<string, MandateViolation[]>();
  for (const violation of mandateViolations) {
    const symbolViolations = violationsBySymbol.get(violation.symbol) ?? [];
    symbolViolations.push(violation);
    violationsBySymbol.set(violation.symbol, symbolViolations);
  }

  const investmentReports = runReportAgent(
    resolvedRequest,
    marketData,
    analysisSignals,
    prompts.report,
  ).map((report) => {
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
      recommended_action_bias: "HOLD",
      rationale: `${report.rationale} Mandate blocked execution: ${violationMessages.join("; ")}`,
    };
  });

  const decisions = runBuySellAgent(investmentReports, prompts.buy_sell);

  const orders = runOrderExecutionAgent(decisions, marketData, prompts.order_execution);

  const evaluationLog = runLogEvaluationAgent(decisions, orders, prompts);

  const runId = `run-${Date.now()}`;

  return {
    run_id: runId,
    created_at: new Date().toISOString(),
    symbols: resolvedRequest.symbols,
    user_prompt: request.user_prompt,
    chat_messages: request.chat_messages,
    runtime: {
      data_mode: provider.mode_name,
      llm_mode: "noop",
      model_name: null,
      agent_models: null,
      live_order_enabled: false,
    },
    mandate,
    supervisor_directive: directive,
    market_data: marketData,
    analysis_signals: analysisSignals,
    investment_reports: investmentReports,
    decisions,
    orders,
    evaluation_log: evaluationLog,
    mandate_violations: mandateViolations,
  };
}
