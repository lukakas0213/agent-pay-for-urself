import type { AgentKey } from "../lib/agent-prompts-store";
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

export function runFeedbackAgent(
  decisions: TradeDecision[],
  reports: InvestmentReport[],
  marketData: MarketData[],
  mandateViolations: MandateViolation[],
  prompts: AgentPromptMap,
): WorkflowFeedback {
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

  return {
    summary: `monitored ${decisions.length} decision(s); ${summarizePrompt(prompts.feedback)}`,
    collection_feedback: collectionFeedback,
    analysis_feedback: analysisFeedback,
    report_feedback: reportFeedback,
    decision_feedback: decisionFeedback,
    follow_up_actions: followUpActions,
    monitored_agents: ["data_collection", "data_analysis", "report", "buy_sell"],
  };
}
