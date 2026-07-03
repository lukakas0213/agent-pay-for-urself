import type { AgentKey } from "../lib/agent-prompts-store";
import type {
  AnalysisSignal,
  EvaluationLog,
  InvestmentReport,
  InvestmentRequest,
  MarketData,
  OrderPlan,
  TradeAction,
  TradeDecision,
} from "./schemas";

const ATTRACTIVE_PE_RATIO = 25.0;
const BUY_THRESHOLD = 0.6;
const SELL_THRESHOLD = 0.35;
const PRICE_SCORE_NEUTRAL = 0.5;
const NEWS_SCORE_SINGLE_HEADLINE = 0.55;
const FINANCIAL_SCORE_ATTRACTIVE = 0.7;
const FINANCIAL_SCORE_NEUTRAL = 0.5;
const DEFAULT_ORDER_QUANTITY = 1;

type AgentPromptMap = Record<AgentKey, string>;

function summarizePrompt(prompt: string): string {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "prompt=empty";
  }
  return `prompt=${normalized.slice(0, 80)}${normalized.length > 80 ? "..." : ""}`;
}

export function runDataAnalysis(
  marketData: MarketData[],
  prompt: string,
): AnalysisSignal[] {
  const promptNote = summarizePrompt(prompt);

  return marketData.map((data) => {
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
}

export function runReportAgent(
  request: InvestmentRequest,
  marketData: MarketData[],
  signals: AnalysisSignal[],
  prompt: string,
): InvestmentReport[] {
  const marketDataBySymbol = new Map(marketData.map((d) => [d.symbol, d]));
  const promptNote = summarizePrompt(prompt);

  return signals.map((signal) => {
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
}

export function runBuySellAgent(
  reports: InvestmentReport[],
  prompt: string,
): TradeDecision[] {
  const promptNote = summarizePrompt(prompt);

  return reports.map((report) => {
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
}

export function runOrderExecutionAgent(
  decisions: TradeDecision[],
  marketData: MarketData[],
  prompt: string,
): OrderPlan[] {
  const mdBySymbol = new Map(marketData.map((d) => [d.symbol, d]));
  const promptNote = summarizePrompt(prompt);

  return decisions.map((decision) => {
    const md = mdBySymbol.get(decision.symbol) ?? null;
    const shouldSubmit =
      (decision.action === "BUY" || decision.action === "SELL") && decision.risk_approved;
    const quantity = shouldSubmit ? DEFAULT_ORDER_QUANTITY : 0;
    const brokerExchangeCode = md?.broker_exchange_code ?? null;
    const limitPrice = md !== null ? Math.round(md.latest_price * 100) / 100 : null;

    let reason: string;
    if (!shouldSubmit) {
      reason = "no executable order";
    } else if (brokerExchangeCode === null) {
      reason = "ready for broker adapter; broker exchange code unavailable";
    } else {
      reason = "ready for broker adapter";
    }

    return {
      symbol: decision.symbol,
      action: decision.action,
      quantity,
      broker_exchange_code: brokerExchangeCode,
      limit_price: limitPrice,
      should_submit: shouldSubmit,
      reason: `${reason}; ${promptNote}`,
    };
  });
}

export function runLogEvaluationAgent(
  decisions: TradeDecision[],
  orders: OrderPlan[],
  prompts: AgentPromptMap,
): EvaluationLog {
  const blockedOrderCount = orders.filter((o) => !o.should_submit).length;
  const notes = decisions.map((d) => `${d.symbol}: ${d.action}`);

  notes.push(`data_collection ${summarizePrompt(prompts.data_collection)}`);
  notes.push(`data_analysis ${summarizePrompt(prompts.data_analysis)}`);
  notes.push(`report ${summarizePrompt(prompts.report)}`);
  notes.push(`buy_sell ${summarizePrompt(prompts.buy_sell)}`);
  notes.push(`order_execution ${summarizePrompt(prompts.order_execution)}`);
  notes.push(`log_evaluation ${summarizePrompt(prompts.log_evaluation)}`);

  return {
    decision_count: decisions.length,
    order_count: orders.length,
    blocked_order_count: blockedOrderCount,
    notes,
  };
}
