import type { AgentKey } from "../lib/agent-prompts-store";
import { invokeJsonCompletion } from "../lib/openai";
import type {
  AnalysisSignal,
  InvestmentReport,
  InvestmentRequest,
  MandateViolation,
  MarketData,
  TradeAction,
  TradeDecision,
  WorkflowFeedback,
} from "./schemas";

const ATTRACTIVE_PE_RATIO = 25.0;
const BUY_THRESHOLD = 0.6;
const SELL_THRESHOLD = 0.35;
const PRICE_SCORE_NEUTRAL = 0.5;
const NEWS_SCORE_SINGLE_HEADLINE = 0.55;
const FINANCIAL_SCORE_ATTRACTIVE = 0.7;
const FINANCIAL_SCORE_NEUTRAL = 0.5;

type AgentPromptMap = Record<AgentKey, string>;

type OpenAiAnalysisSignal = {
  symbol: string;
  price_score: number;
  news_score: number;
  financial_score: number;
  total_score: number;
  rationale: string;
};

type OpenAiInvestmentReport = {
  symbol: string;
  summary: string;
  bull_points: string[];
  bear_points: string[];
  risk_flags: string[];
  risk_approved: boolean;
  recommended_action_bias: TradeAction;
  signal_strength: number;
  rationale: string;
};

type OpenAiTradeDecision = {
  symbol: string;
  action: TradeAction;
  confidence: number;
  rationale: string;
  risk_approved: boolean;
};

type OpenAiWorkflowFeedback = WorkflowFeedback;

function summarizePrompt(prompt: string): string {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "prompt=empty";
  }
  return `prompt=${normalized.slice(0, 80)}${normalized.length > 80 ? "..." : ""}`;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
}

function toTradeAction(value: unknown, fallback: TradeAction = "HOLD"): TradeAction {
  return value === "BUY" || value === "SELL" || value === "HOLD" ? value : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAnalysisSignals(
  rawSignals: unknown,
  marketData: MarketData[],
): AnalysisSignal[] | null {
  if (!Array.isArray(rawSignals) || rawSignals.length === 0) {
    return null;
  }

  const expectedSymbols = new Set(marketData.map((item) => item.symbol));
  const normalized = rawSignals
    .map((signal): AnalysisSignal | null => {
      if (!signal || typeof signal !== "object") {
        return null;
      }
      const item = signal as Partial<OpenAiAnalysisSignal>;
      if (!item.symbol || !expectedSymbols.has(String(item.symbol))) {
        return null;
      }
      return {
        symbol: String(item.symbol),
        price_score: clamp01(toNumber(item.price_score, PRICE_SCORE_NEUTRAL)),
        news_score: clamp01(toNumber(item.news_score, FINANCIAL_SCORE_NEUTRAL)),
        financial_score: clamp01(toNumber(item.financial_score, FINANCIAL_SCORE_NEUTRAL)),
        total_score: clamp01(
          toNumber(
            item.total_score,
            (PRICE_SCORE_NEUTRAL + FINANCIAL_SCORE_NEUTRAL + FINANCIAL_SCORE_NEUTRAL) / 3,
          ),
        ),
        rationale: String(item.rationale ?? "").trim(),
      };
    })
    .filter((item): item is AnalysisSignal => item !== null);

  return normalized.length === marketData.length ? normalized : null;
}

function normalizeInvestmentReports(
  rawReports: unknown,
  request: InvestmentRequest,
  signals: AnalysisSignal[],
): InvestmentReport[] | null {
  if (!Array.isArray(rawReports) || rawReports.length === 0) {
    return null;
  }

  const expectedSymbols = new Set(signals.map((signal) => signal.symbol));
  const normalized = rawReports
    .map((report): InvestmentReport | null => {
      if (!report || typeof report !== "object") {
        return null;
      }
      const item = report as Partial<OpenAiInvestmentReport>;
      if (!item.symbol || !expectedSymbols.has(String(item.symbol))) {
        return null;
      }

      const recommendedActionBias = toTradeAction(item.recommended_action_bias);
      const riskApproved = toBoolean(item.risk_approved, false);
      const signalStrength = clamp01(toNumber(item.signal_strength, 0));

      return {
        symbol: String(item.symbol),
        summary: String(item.summary ?? "").trim(),
        bull_points: toStringArray(item.bull_points, ["no strong bullish driver identified"]),
        bear_points: toStringArray(item.bear_points, ["no material bearish driver identified"]),
        risk_flags: toStringArray(item.risk_flags, ["risk rules passed"]),
        risk_approved: riskApproved,
        max_position_weight: request.max_position_weight,
        recommended_action_bias: riskApproved ? recommendedActionBias : "HOLD",
        signal_strength: signalStrength,
        rationale: String(item.rationale ?? "").trim(),
      };
    })
    .filter((item): item is InvestmentReport => item !== null);

  return normalized.length === signals.length ? normalized : null;
}

function normalizeTradeDecisions(rawDecisions: unknown, reports: InvestmentReport[]): TradeDecision[] | null {
  if (!Array.isArray(rawDecisions) || rawDecisions.length === 0) {
    return null;
  }

  const expectedSymbols = new Set(reports.map((report) => report.symbol));
  const normalized = rawDecisions
    .map((decision): TradeDecision | null => {
      if (!decision || typeof decision !== "object") {
        return null;
      }
      const item = decision as Partial<OpenAiTradeDecision>;
      if (!item.symbol || !expectedSymbols.has(String(item.symbol))) {
        return null;
      }

      return {
        symbol: String(item.symbol),
        action: toTradeAction(item.action),
        confidence: clamp01(toNumber(item.confidence, 0)),
        rationale: String(item.rationale ?? "").trim(),
        risk_approved: toBoolean(item.risk_approved, false),
      };
    })
    .filter((item): item is TradeDecision => item !== null);

  return normalized.length === reports.length ? normalized : null;
}

function normalizeWorkflowFeedback(rawFeedback: unknown): WorkflowFeedback | null {
  if (!rawFeedback || typeof rawFeedback !== "object") {
    return null;
  }

  const item = rawFeedback as Partial<OpenAiWorkflowFeedback>;
  const summary = String(item.summary ?? "").trim();
  if (!summary) {
    return null;
  }

  return {
    summary,
    collection_feedback: toStringArray(item.collection_feedback),
    analysis_feedback: toStringArray(item.analysis_feedback),
    report_feedback: toStringArray(item.report_feedback),
    decision_feedback: toStringArray(item.decision_feedback),
    follow_up_actions: toStringArray(item.follow_up_actions),
    monitored_agents: toStringArray(item.monitored_agents),
  };
}

export async function runDataAnalysis(
  marketData: MarketData[],
  prompt: string,
): Promise<AnalysisSignal[]> {
  const promptNote = summarizePrompt(prompt);
  const fallback = marketData.map((data) => {
    const peRatio = data.financial_metrics["pe_ratio"];
    const financialScore =
      peRatio !== undefined && peRatio <= ATTRACTIVE_PE_RATIO
        ? FINANCIAL_SCORE_ATTRACTIVE
        : FINANCIAL_SCORE_NEUTRAL;

    const newsScore =
      data.news_headlines.length > 0 ? NEWS_SCORE_SINGLE_HEADLINE : FINANCIAL_SCORE_NEUTRAL;

    const priceScore = PRICE_SCORE_NEUTRAL;
    const totalScore = (priceScore + newsScore + financialScore) / 3;

    return {
      symbol: data.symbol,
      price_score: priceScore,
      news_score: newsScore,
      financial_score: financialScore,
      total_score: Math.round(totalScore * 10000) / 10000,
      rationale: `${data.symbol}: price, news, and financial data were reviewed; PE ratio=${peRatio ?? null}; ${promptNote}.`,
    };
  });

  const normalized = normalizeAnalysisSignals(
    await invokeJsonCompletion<unknown>({
      agentKey: "data_analysis",
      systemPrompt: [
        "You are the data analysis agent in a stock workflow.",
        prompt,
        "Return JSON with an array named analysis_signals.",
        "Each item must include symbol, price_score, news_score, financial_score, total_score, and rationale.",
        "Keep scores between 0 and 1.",
      ].join("\n"),
      userPayload: { market_data: marketData },
    }),
    marketData,
  );

  return normalized ?? fallback;
}

export async function runReportAgent(
  request: InvestmentRequest,
  marketData: MarketData[],
  signals: AnalysisSignal[],
  prompt: string,
): Promise<InvestmentReport[]> {
  const marketDataBySymbol = new Map(marketData.map((d) => [d.symbol, d]));
  const promptNote = summarizePrompt(prompt);
  const fallback = signals.map((signal) => {
    const md = marketDataBySymbol.get(signal.symbol) ?? null;
    const riskFlags: string[] = [];
    const bullPoints: string[] = [];
    const bearPoints: string[] = [];

    if (request.max_position_weight <= 0 || request.max_position_weight > 1) {
      riskFlags.push("max_position_weight must be greater than 0 and less than or equal to 1");
    }
    if (!signal.rationale) {
      riskFlags.push("investment rationale is required");
    }

    if (md !== null) {
      if (md.news_headlines.length > 0) {
        bullPoints.push(`news support present: ${md.news_headlines.length} headline(s)`);
      } else {
        bearPoints.push("no news catalyst collected");
      }
      const peRatio = md.financial_metrics["pe_ratio"];
      if (peRatio === undefined) {
        bearPoints.push("financial metrics are incomplete");
      } else if (peRatio <= ATTRACTIVE_PE_RATIO) {
        bullPoints.push(`valuation looks reasonable at PE ${peRatio}`);
      } else {
        bearPoints.push(`valuation looks expensive at PE ${peRatio}`);
      }
    } else {
      bearPoints.push("market data record missing for report generation");
      riskFlags.push("market data record missing");
    }

    let recommendedActionBias: TradeAction;
    if (signal.total_score >= BUY_THRESHOLD) {
      recommendedActionBias = "BUY";
    } else if (signal.total_score <= SELL_THRESHOLD) {
      recommendedActionBias = "SELL";
    } else {
      recommendedActionBias = "HOLD";
    }

    const riskApproved = riskFlags.length === 0;
    if (!riskApproved) {
      recommendedActionBias = "HOLD";
    }

    const summaryParts = [`signal_strength=${signal.total_score.toFixed(2)}`];
    if (bullPoints.length > 0) summaryParts.push(`bull=${bullPoints[0]}`);
    if (bearPoints.length > 0) summaryParts.push(`bear=${bearPoints[0]}`);
    if (riskFlags.length > 0) summaryParts.push(`risk=${riskFlags[0]}`);
    summaryParts.push(promptNote);

    const rationale =
      `${signal.symbol}: ${signal.rationale} ` +
      `Recommended bias=${recommendedActionBias} with max position ` +
      `weight ${request.max_position_weight.toFixed(2)}. ${promptNote}.`;

    return {
      symbol: signal.symbol,
      summary: summaryParts.join("; "),
      bull_points: bullPoints.length > 0 ? bullPoints : ["no strong bullish driver identified"],
      bear_points: bearPoints.length > 0 ? bearPoints : ["no material bearish driver identified"],
      risk_flags: riskFlags.length > 0 ? riskFlags : ["risk rules passed"],
      risk_approved: riskApproved,
      max_position_weight: request.max_position_weight,
      recommended_action_bias: recommendedActionBias,
      signal_strength: Math.round(signal.total_score * 10000) / 10000,
      rationale,
    };
  });

  const normalized = normalizeInvestmentReports(
    await invokeJsonCompletion<unknown>({
      agentKey: "report",
      systemPrompt: [
        "You are the report agent in a stock workflow.",
        prompt,
        "Return JSON with an array named investment_reports.",
        "Each item must include symbol, summary, bull_points, bear_points, risk_flags, risk_approved, recommended_action_bias, signal_strength, and rationale.",
        "Use BUY, SELL, or HOLD for recommended_action_bias.",
      ].join("\n"),
      userPayload: {
        request,
        market_data: marketData,
        analysis_signals: signals,
      },
    }),
    request,
    signals,
  );

  return normalized ?? fallback;
}

export async function runBuySellAgent(
  reports: InvestmentReport[],
  prompt: string,
): Promise<TradeDecision[]> {
  const promptNote = summarizePrompt(prompt);
  const fallback = reports.map((report) => {
    if (!report.risk_approved) {
      return {
        symbol: report.symbol,
        action: "HOLD" as TradeAction,
        confidence: 0.0,
        rationale: `Report risk review failed: ${report.risk_flags.join("; ")}. ${report.summary}; ${promptNote}`,
        risk_approved: false,
      };
    }
    return {
      symbol: report.symbol,
      action: report.recommended_action_bias,
      confidence: report.signal_strength,
      rationale: `${report.rationale} ${promptNote}`,
      risk_approved: true,
    };
  });

  const normalized = normalizeTradeDecisions(
    await invokeJsonCompletion<unknown>({
      agentKey: "buy_sell",
      systemPrompt: [
        "You are the buy/sell decision agent in a stock workflow.",
        prompt,
        "Return JSON with an array named decisions.",
        "Each item must include symbol, action, confidence, rationale, and risk_approved.",
        "Use BUY, SELL, or HOLD for action.",
      ].join("\n"),
      userPayload: {
        reports,
      },
    }),
    reports,
  );

  return normalized ?? fallback;
}

export async function runFeedbackAgent(
  decisions: TradeDecision[],
  reports: InvestmentReport[],
  marketData: MarketData[],
  mandateViolations: MandateViolation[],
  prompts: AgentPromptMap,
): Promise<WorkflowFeedback> {
  const collectionFeedback: string[] = [];
  const analysisFeedback: string[] = [];
  const reportFeedback: string[] = [];
  const decisionFeedback: string[] = [];
  const followUpActions: string[] = [];

  const marketDataBySymbol = new Map(marketData.map((item) => [item.symbol, item]));

  for (const item of marketData) {
    if (item.news_headlines.length === 0) {
      collectionFeedback.push(`${item.symbol}: 뉴스 데이터가 비어 있어 재수집 후보입니다.`);
    }
    if (Object.keys(item.financial_metrics).length === 0) {
      collectionFeedback.push(`${item.symbol}: 재무 지표가 부족해 재수집이 필요합니다.`);
    }
  }

  for (const report of reports) {
    const md = marketDataBySymbol.get(report.symbol);
    if (!md) {
      analysisFeedback.push(`${report.symbol}: 원본 시장 데이터가 없어 분석 신뢰도가 낮습니다.`);
      continue;
    }
    if (md.news_headlines.length === 0 || md.financial_metrics["pe_ratio"] === undefined) {
      analysisFeedback.push(`${report.symbol}: 데이터 결손으로 분석을 다시 수행할 여지가 있습니다.`);
    }
    if (!report.risk_approved) {
      reportFeedback.push(`${report.symbol}: 보고서 리스크 승인 실패 - ${report.risk_flags.join("; ")}`);
    }
  }

  for (const decision of decisions) {
    if (!decision.risk_approved) {
      decisionFeedback.push(`${decision.symbol}: 리스크 미승인으로 ${decision.action} 대신 보류 상태입니다.`);
    } else if (decision.action === "HOLD") {
      decisionFeedback.push(`${decision.symbol}: 판단 보류. 추가 데이터나 재분석을 검토하세요.`);
    }
  }

  for (const violation of mandateViolations) {
    followUpActions.push(`${violation.symbol}: mandate 위반 해결 전까지 재실행보다 정책 수정 여부를 먼저 확인하세요.`);
  }

  if (collectionFeedback.length > 0) {
    followUpActions.push("데이터 수집 에이전트에 부족한 뉴스/재무 지표 재요청");
  }
  if (analysisFeedback.length > 0) {
    followUpActions.push("데이터 분석 에이전트에 결손 데이터 기반 종목 재분석 요청");
  }
  if (reportFeedback.length > 0) {
    followUpActions.push("보고서 에이전트에 리스크 사유를 더 구체적으로 재정리 요청");
  }
  if (decisionFeedback.length > 0) {
    followUpActions.push("매수/매도 에이전트에 HOLD 근거를 보강하거나 판단 유예 유지");
  }
  if (followUpActions.length === 0) {
    followUpActions.push("현재 시스템 상태 양호. 다음 사이클에서도 동일한 점검 순서를 유지");
  }

  const fallback: WorkflowFeedback = {
    summary: `monitored ${decisions.length} decision(s); ${summarizePrompt(prompts.feedback)}`,
    collection_feedback: collectionFeedback,
    analysis_feedback: analysisFeedback,
    report_feedback: reportFeedback,
    decision_feedback: decisionFeedback,
    follow_up_actions: followUpActions,
    monitored_agents: ["data_collection", "data_analysis", "report", "buy_sell"],
  };

  const normalized = normalizeWorkflowFeedback(
    await invokeJsonCompletion<unknown>({
      agentKey: "feedback",
      systemPrompt: [
        "You are the feedback agent in a stock workflow.",
        prompts.feedback,
        "Return JSON with summary, collection_feedback, analysis_feedback, report_feedback, decision_feedback, follow_up_actions, and monitored_agents.",
      ].join("\n"),
      userPayload: {
        decisions,
        reports,
        market_data: marketData,
        mandate_violations: mandateViolations,
      },
    }),
  );

  return normalized ?? fallback;
}
