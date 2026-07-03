import { buildApiUrl } from "./api";

export type TradeAction = "BUY" | "SELL" | "HOLD";
export type RiskTolerance = "low" | "medium" | "high";
export type AgentKey =
  | "data_collection"
  | "data_analysis"
  | "report"
  | "buy_sell"
  | "order_execution"
  | "log_evaluation";

export type MarketData = {
  symbol: string;
  latest_price: number;
  broker_exchange_code: string | null;
  news_headlines: string[];
  financial_metrics: Record<string, number>;
};

export type AnalysisSignal = {
  symbol: string;
  price_score: number;
  news_score: number;
  financial_score: number;
  total_score: number;
  rationale: string;
};

export type InvestmentReport = {
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
};

export type Decision = {
  symbol: string;
  action: TradeAction;
  confidence: number;
  rationale: string;
  risk_approved: boolean;
};

export type OrderPlan = {
  symbol: string;
  action: TradeAction;
  quantity: number;
  broker_exchange_code: string | null;
  limit_price: number | null;
  should_submit: boolean;
  reason: string;
};

export type EvaluationLog = {
  decision_count: number;
  order_count: number;
  blocked_order_count: number;
  notes: string[];
};

export type Mandate = {
  objective: string;
  allowed_symbols: string[];
  excluded_symbols: string[];
  max_position_weight: number;
  max_order_notional: number | null;
  min_cash_weight: number | null;
  risk_tolerance: RiskTolerance;
  requires_approval_for_live_orders: boolean;
  user_notes: string;
};

export type MandateViolation = {
  symbol: string;
  rule: string;
  message: string;
};

export type SupervisorDirective = {
  objective: string;
  focus_symbols: string[];
  watch_symbols: string[];
  guidance: string[];
  summary: string;
};

export type RuntimeSummary = {
  data_mode: string;
  llm_mode: string;
  model_name: string | null;
  agent_models: Record<string, string> | null;
  live_order_enabled: boolean;
};

export type DecisionResponse = {
  run_id: string;
  symbols: string[];
  user_prompt: string;
  chat_messages: string[];
  runtime: RuntimeSummary | null;
  mandate: Mandate;
  supervisor_directive: SupervisorDirective;
  market_data: MarketData[];
  analysis_signals: AnalysisSignal[];
  investment_reports: InvestmentReport[];
  decisions: Decision[];
  orders: OrderPlan[];
  evaluation_log: EvaluationLog;
  mandate_violations: MandateViolation[];
};

export type DecisionRequest = {
  symbols: string[];
  max_position_weight: number;
  user_prompt: string;
  chat_messages: string[];
  mandate: {
    objective: string;
    allowed_symbols: string[];
    excluded_symbols: string[];
    max_order_notional: number | null;
    min_cash_weight: number | null;
    risk_tolerance: RiskTolerance;
    requires_approval_for_live_orders: boolean;
    user_notes: string;
  } | null;
};

export type PromptOverrides = {
  data_collection: string;
  data_analysis: string;
  report: string;
  buy_sell: string;
  order_execution: string;
  log_evaluation: string;
};

export type ExperimentListItem = {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  symbols: string[];
  decision_actions: Record<string, TradeAction>;
  runtime: RuntimeSummary | null;
};

export type ExperimentResponse = {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  decision: {
    symbols: string[];
    max_position_weight: number;
    mandate: Mandate | null;
  };
  prompt_overrides: PromptOverrides;
  runtime: RuntimeSummary | null;
  result: DecisionResponse;
};

export type AgentPromptItem = {
  agent_key: AgentKey;
  label: string;
  prompt: string;
  updated_at: string;
  source: string;
};

export type AgentPromptSaveResponse = {
  item: AgentPromptItem;
};

export type AgentPromptUpdateRequest = {
  prompt: string;
};

export type AgentDefinition = {
  key: AgentKey;
  label: string;
  description: string;
  path: string;
};

export type AccountHolding = {
  symbol: string;
  name: string;
  quantity: number;
  average_price: number;
  current_price: number;
  market_value: number;
  profit_loss: number;
  profit_loss_rate: number;
};

export type AccountSummary = {
  cash_balance: number;
  total_purchase_amount: number;
  total_evaluation_amount: number;
  total_profit_loss: number;
  total_profit_loss_rate: number;
};

export type AccountResponse = {
  available: boolean;
  broker: string;
  account_masked: string | null;
  summary: AccountSummary | null;
  holdings: AccountHolding[];
  message: string;
};

export type AgentInteractionResponse = {
  focus: string;
  reply: string;
  suggested_actions: string[];
  applied_to_workflow: boolean;
  updated_run_id: string | null;
  updated_result: DecisionResponse | null;
};

export type FrontendWorkspaceSettings = {
  default_symbols: string;
  default_max_position_weight: string;
  default_risk_tolerance: RiskTolerance;
  auto_apply_chat_followups: boolean;
  timeline_limit: number;
  auto_trading_enabled: boolean;
  account_alias: string;
  account_number: string;
  account_product_code: string;
  broker_label: string;
};

export const agentDefinitions: AgentDefinition[] = [
  {
    key: "data_collection",
    label: "데이터 수집",
    description: "종목별 시세, 뉴스, 재무 지표를 수집합니다.",
    path: "/agents/data_collection",
  },
  {
    key: "data_analysis",
    label: "데이터 분석",
    description: "수집한 데이터를 점수와 해석 근거로 압축합니다.",
    path: "/agents/data_analysis",
  },
  {
    key: "report",
    label: "보고서 작성",
    description: "주문 전 리스크와 액션 편향을 구조화합니다.",
    path: "/agents/report",
  },
  {
    key: "buy_sell",
    label: "매수/매도 판단",
    description: "보고서 결과를 바탕으로 최종 액션을 결정합니다.",
    path: "/agents/buy_sell",
  },
  {
    key: "order_execution",
    label: "주문 실행",
    description: "제출 가능한 주문 계획과 차단 사유를 정리합니다.",
    path: "/agents/order_execution",
  },
  {
    key: "log_evaluation",
    label: "로그/평가",
    description: "전체 실행을 요약하고 다음 확인 지점을 남깁니다.",
    path: "/agents/log_evaluation",
  },
];

export const primaryNavItems = [
  { label: "메인화면", href: "/" },
  { label: "계좌 상태", href: "/account" },
  { label: "보고서", href: "/reports" },
  { label: "에이전트", href: "/agents" },
  { label: "프롬프트 설정", href: "/settings" },
];

export const agentNavItems = agentDefinitions.map((agent) => ({
  label: agent.label,
  href: agent.path,
  description: agent.description,
}));

export const emptyPromptOverrides: PromptOverrides = {
  data_collection: "",
  data_analysis: "",
  report: "",
  buy_sell: "",
  order_execution: "",
  log_evaluation: "",
};

const FRONTEND_SETTINGS_KEY = "frontend-workspace-settings";

export function defaultFrontendWorkspaceSettings(): FrontendWorkspaceSettings {
  return {
    default_symbols: "AAPL, MSFT",
    default_max_position_weight: "0.2",
    default_risk_tolerance: "medium",
    auto_apply_chat_followups: true,
    timeline_limit: 12,
    auto_trading_enabled: false,
    account_alias: "모의투자 계좌",
    account_number: "",
    account_product_code: "",
    broker_label: "한국투자증권",
  };
}

export function loadFrontendWorkspaceSettings(): FrontendWorkspaceSettings {
  if (typeof window === "undefined") {
    return defaultFrontendWorkspaceSettings();
  }

  const raw = window.localStorage.getItem(FRONTEND_SETTINGS_KEY);
  if (!raw) {
    return defaultFrontendWorkspaceSettings();
  }

  try {
    return {
      ...defaultFrontendWorkspaceSettings(),
      ...(JSON.parse(raw) as Partial<FrontendWorkspaceSettings>),
    };
  } catch {
    return defaultFrontendWorkspaceSettings();
  }
}

export function saveFrontendWorkspaceSettings(settings: FrontendWorkspaceSettings) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FRONTEND_SETTINGS_KEY, JSON.stringify(settings));
}

export function parseSymbols(value: string) {
  return value
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatPercentValue(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatAmount(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedAmount(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatAmount(value)}`;
}

export function formatScore(value: number) {
  return value.toFixed(2);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMetrics(metrics: Record<string, number>) {
  const entries = Object.entries(metrics);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(" / ") : "없음";
}

export function actionLabel(action: TradeAction) {
  if (action === "BUY") return "매수";
  if (action === "SELL") return "매도";
  return "보류";
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  detail: string | null;
  responseBody: string;

  constructor(params: {
    message: string;
    status: number;
    statusText: string;
    url: string;
    detail: string | null;
    responseBody: string;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
    this.detail = params.detail;
    this.responseBody = params.responseBody;
  }
}

function summarizeApiErrorBody(body: string, contentType: string | null): string | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  if (contentType?.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "string") {
        return parsed.trim() || null;
      }
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const detail = record.detail ?? record.message ?? record.error ?? record.reason;
        if (typeof detail === "string" && detail.trim()) {
          return detail.trim();
        }
        return JSON.stringify(parsed);
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function buildApiErrorMessage(
  path: string,
  response: Response,
  detail: string | null,
  method?: string,
) {
  const statusBits = [response.status.toString(), response.statusText].filter(Boolean).join(" ");
  const methodPrefix = method ? `${method.toUpperCase()} ` : "";
  const prefix = `API 요청 실패: ${methodPrefix}${path} -> ${statusBits}`;
  return detail ? `${prefix} - ${detail}` : prefix;
}

export function runtimeLabel(runtime: RuntimeSummary | null) {
  if (!runtime) {
    return "런타임 정보 없음";
  }
  const model = runtime.model_name ? ` / ${runtime.model_name}` : "";
  return `${runtime.data_mode} data / ${runtime.llm_mode}${model}`;
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOrDefault(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function stringArrayOrEmpty(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function recordOrNull(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function numberRecordOrEmpty(value: unknown) {
  const record = recordOrNull(value);
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).filter(([, item]) => typeof item === "number" && Number.isFinite(item)),
  ) as Record<string, number>;
}

function stringRecordOrNull(value: unknown) {
  const record = recordOrNull(value);
  if (!record) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(record).filter(([, item]) => typeof item === "string"),
  ) as Record<string, string>;
}

function mapArray<T>(value: unknown, mapper: (item: unknown) => T) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => mapper(item));
}

function normalizeRuntimeSummary(value: unknown): RuntimeSummary | null {
  const runtime = recordOrNull(value);
  if (!runtime) {
    return null;
  }

  return {
    data_mode: stringOrEmpty(runtime.data_mode),
    llm_mode: stringOrEmpty(runtime.llm_mode),
    model_name: typeof runtime.model_name === "string" ? runtime.model_name : null,
    agent_models: stringRecordOrNull(runtime.agent_models),
    live_order_enabled: booleanOrDefault(runtime.live_order_enabled),
  };
}

function normalizeMandate(value: unknown): Mandate {
  const mandate = recordOrNull(value);
  const riskTolerance = mandate?.risk_tolerance;

  return {
    objective: stringOrEmpty(mandate?.objective),
    allowed_symbols: stringArrayOrEmpty(mandate?.allowed_symbols),
    excluded_symbols: stringArrayOrEmpty(mandate?.excluded_symbols),
    max_position_weight: numberOrDefault(mandate?.max_position_weight),
    max_order_notional:
      typeof mandate?.max_order_notional === "number" && Number.isFinite(mandate.max_order_notional)
        ? mandate.max_order_notional
        : null,
    min_cash_weight:
      typeof mandate?.min_cash_weight === "number" && Number.isFinite(mandate.min_cash_weight)
        ? mandate.min_cash_weight
        : null,
    risk_tolerance: riskTolerance === "low" || riskTolerance === "high" ? riskTolerance : "medium",
    requires_approval_for_live_orders: booleanOrDefault(mandate?.requires_approval_for_live_orders, true),
    user_notes: stringOrEmpty(mandate?.user_notes),
  };
}

function normalizeMarketData(value: unknown): MarketData {
  const item = recordOrNull(value);
  return {
    symbol: stringOrEmpty(item?.symbol),
    latest_price: numberOrDefault(item?.latest_price),
    broker_exchange_code: typeof item?.broker_exchange_code === "string" ? item.broker_exchange_code : null,
    news_headlines: stringArrayOrEmpty(item?.news_headlines),
    financial_metrics: numberRecordOrEmpty(item?.financial_metrics),
  };
}

function normalizeAnalysisSignal(value: unknown): AnalysisSignal {
  const item = recordOrNull(value);
  return {
    symbol: stringOrEmpty(item?.symbol),
    price_score: numberOrDefault(item?.price_score),
    news_score: numberOrDefault(item?.news_score),
    financial_score: numberOrDefault(item?.financial_score),
    total_score: numberOrDefault(item?.total_score),
    rationale: stringOrEmpty(item?.rationale),
  };
}

function normalizeInvestmentReport(value: unknown): InvestmentReport {
  const item = recordOrNull(value);
  const action = item?.recommended_action_bias;

  return {
    symbol: stringOrEmpty(item?.symbol),
    summary: stringOrEmpty(item?.summary),
    bull_points: stringArrayOrEmpty(item?.bull_points),
    bear_points: stringArrayOrEmpty(item?.bear_points),
    risk_flags: stringArrayOrEmpty(item?.risk_flags),
    risk_approved: booleanOrDefault(item?.risk_approved),
    max_position_weight: numberOrDefault(item?.max_position_weight),
    recommended_action_bias: action === "BUY" || action === "SELL" || action === "HOLD" ? action : "HOLD",
    signal_strength: numberOrDefault(item?.signal_strength),
    rationale: stringOrEmpty(item?.rationale),
  };
}

function normalizeDecision(value: unknown): Decision {
  const item = recordOrNull(value);
  const action = item?.action;

  return {
    symbol: stringOrEmpty(item?.symbol),
    action: action === "BUY" || action === "SELL" || action === "HOLD" ? action : "HOLD",
    confidence: numberOrDefault(item?.confidence),
    rationale: stringOrEmpty(item?.rationale),
    risk_approved: booleanOrDefault(item?.risk_approved),
  };
}

function normalizeOrderPlan(value: unknown): OrderPlan {
  const item = recordOrNull(value);
  const action = item?.action;

  return {
    symbol: stringOrEmpty(item?.symbol),
    action: action === "BUY" || action === "SELL" || action === "HOLD" ? action : "HOLD",
    quantity: numberOrDefault(item?.quantity),
    broker_exchange_code: typeof item?.broker_exchange_code === "string" ? item.broker_exchange_code : null,
    limit_price: typeof item?.limit_price === "number" && Number.isFinite(item.limit_price) ? item.limit_price : null,
    should_submit: booleanOrDefault(item?.should_submit),
    reason: stringOrEmpty(item?.reason),
  };
}

function normalizeEvaluationLog(value: unknown, decisionCount: number, orderCount: number): EvaluationLog {
  const item = recordOrNull(value);
  return {
    decision_count: numberOrDefault(item?.decision_count, decisionCount),
    order_count: numberOrDefault(item?.order_count, orderCount),
    blocked_order_count: numberOrDefault(item?.blocked_order_count),
    notes: stringArrayOrEmpty(item?.notes),
  };
}

function normalizeMandateViolation(value: unknown): MandateViolation {
  const item = recordOrNull(value);
  return {
    symbol: stringOrEmpty(item?.symbol),
    rule: stringOrEmpty(item?.rule),
    message: stringOrEmpty(item?.message),
  };
}

export function normalizeSupervisorDirective(value: unknown, fallbackObjective = ""): SupervisorDirective {
  const directive = value && typeof value === "object" ? (value as Partial<SupervisorDirective>) : null;
  return {
    objective: stringOrEmpty(directive?.objective) || fallbackObjective,
    focus_symbols: stringArrayOrEmpty(directive?.focus_symbols),
    watch_symbols: stringArrayOrEmpty(directive?.watch_symbols),
    guidance: stringArrayOrEmpty(directive?.guidance),
    summary: stringOrEmpty(directive?.summary),
  };
}

export function normalizeDecisionResponse(value: unknown): DecisionResponse | null {
  const result = recordOrNull(value);
  if (!result) {
    return null;
  }

  const decisions = mapArray(result.decisions ?? result.trade_decisions, normalizeDecision);
  const orders = mapArray(result.orders ?? result.order_plans, normalizeOrderPlan);
  const userPrompt = stringOrEmpty(result.user_prompt);

  return {
    run_id: stringOrEmpty(result.run_id),
    symbols: stringArrayOrEmpty(result.symbols),
    user_prompt: userPrompt,
    chat_messages: stringArrayOrEmpty(result.chat_messages),
    runtime: normalizeRuntimeSummary(result.runtime),
    mandate: normalizeMandate(result.mandate),
    supervisor_directive: normalizeSupervisorDirective(result.supervisor_directive, userPrompt),
    market_data: mapArray(result.market_data, normalizeMarketData),
    analysis_signals: mapArray(result.analysis_signals, normalizeAnalysisSignal),
    investment_reports: mapArray(result.investment_reports, normalizeInvestmentReport),
    decisions,
    orders,
    evaluation_log: normalizeEvaluationLog(result.evaluation_log, decisions.length, orders.length),
    mandate_violations: mapArray(result.mandate_violations, normalizeMandateViolation),
  };
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const response = await fetch(url, init);
  if (!response.ok) {
    const responseBody = await response.text();
    const detail = summarizeApiErrorBody(responseBody, response.headers.get("content-type"));
    throw new ApiError({
      message: buildApiErrorMessage(path, response, detail, init?.method),
      status: response.status,
      statusText: response.statusText,
      url,
      detail,
      responseBody,
    });
  }
  return (await response.json()) as T;
}
