export type TradeAction = "BUY" | "SELL" | "HOLD";
export type RiskTolerance = "low" | "medium" | "high";

export interface InvestmentMandate {
  objective: string;
  allowed_symbols: string[];
  excluded_symbols: string[];
  max_position_weight: number;
  max_order_notional: number | null;
  min_cash_weight: number | null;
  risk_tolerance: RiskTolerance;
  requires_approval_for_live_orders: boolean;
  user_notes: string;
}

export interface MandateViolation {
  symbol: string;
  rule: string;
  message: string;
}

export interface InvestmentRequest {
  symbols: string[];
  max_position_weight: number;
  mandate: InvestmentMandate | null;
  user_prompt: string;
  chat_messages: string[];
  prompt_overrides: Record<string, string>;
}

export interface SupervisorDirective {
  objective: string;
  focus_symbols: string[];
  watch_symbols: string[];
  guidance: string[];
  summary: string;
}

export interface MarketData {
  symbol: string;
  latest_price: number;
  broker_exchange_code: string | null;
  news_headlines: string[];
  financial_metrics: Record<string, number>;
}

export interface AnalysisSignal {
  symbol: string;
  price_score: number;
  news_score: number;
  financial_score: number;
  total_score: number;
  rationale: string;
}

export interface InvestmentReport {
  symbol: string;
  summary: string;
  bull_points: string[];
  bear_points: string[];
  risk_flags: string[];
  risk_approved: boolean;
  max_position_weight: number;
  recommended_action_bias: TradeAction;
  signal_strength: number;
  rationale: string;
}

export interface TradeDecision {
  symbol: string;
  action: TradeAction;
  confidence: number;
  rationale: string;
  risk_approved: boolean;
}

export interface OrderPlan {
  symbol: string;
  action: TradeAction;
  quantity: number;
  broker_exchange_code: string | null;
  limit_price: number | null;
  should_submit: boolean;
  reason: string;
}

export interface EvaluationLog {
  decision_count: number;
  order_count: number;
  blocked_order_count: number;
  notes: string[];
}

export interface WorkflowResult {
  run_id: string;
  symbols: string[];
  user_prompt: string;
  chat_messages: string[];
  runtime: {
    data_mode: string;
    llm_mode: string;
    model_name: string | null;
    agent_models: null;
    live_order_enabled: boolean;
  };
  mandate: InvestmentMandate;
  supervisor_directive: SupervisorDirective;
  market_data: MarketData[];
  analysis_signals: AnalysisSignal[];
  investment_reports: InvestmentReport[];
  decisions: TradeDecision[];
  orders: OrderPlan[];
  evaluation_log: EvaluationLog;
  mandate_violations: MandateViolation[];
}
