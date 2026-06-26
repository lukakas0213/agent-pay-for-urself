
import { buildApiUrl } from "./api";

export type TradeAction = "BUY" | "SELL" | "HOLD";
export type RiskTolerance = "low" | "medium" | "high";
export type AgentKey =
  | "data_collection"
  | "data_analysis"
  | "risk_management"
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

export type RiskAssessment = {
  symbol: string;
  approved: boolean;
  reasons: string[];
  max_position_weight: number;
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
  runtime: RuntimeSummary;
  mandate: Mandate;
  market_data: MarketData[];
  analysis_signals: AnalysisSignal[];
  risk_assessments: RiskAssessment[];
  decisions: Decision[];
  orders: OrderPlan[];
  evaluation_log: EvaluationLog;
  mandate_violations: MandateViolation[];
};

export type DecisionRequest = {
  symbols: string[];
  max_position_weight: number;
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
  risk_management: string;
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
  runtime: RuntimeSummary;
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
  runtime: RuntimeSummary;
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

export const agentDefinitions: AgentDefinition[] = [
  {
    key: "data_collection",
    label: "데이터 수집",
    description: "종목별 시장 데이터와 뉴스, 재무 지표를 모읍니다.",
    path: "/agents/data_collection",
  },
  {
    key: "data_analysis",
    label: "데이터 분석",
    description: "수집한 데이터를 점수와 근거로 정리합니다.",
    path: "/agents/data_analysis",
  },
  {
    key: "risk_management",
    label: "리스크 관리",
    description: "비중 제한과 승인 조건을 검증합니다.",
    path: "/agents/risk_management",
  },
  {
    key: "buy_sell",
    label: "매수/매도 판단",
    description: "리스크 승인 결과와 점수를 바탕으로 행동을 결정합니다.",
    path: "/agents/buy_sell",
  },
  {
    key: "order_execution",
    label: "주문 실행",
    description: "실제 제출 전 주문 계획을 만듭니다.",
    path: "/agents/order_execution",
  },
  {
    key: "log_evaluation",
    label: "로그/평가",
    description: "워크플로우 결과를 실행 요약으로 묶습니다.",
    path: "/agents/log_evaluation",
  },
];

export const primaryNavItems = [
  { label: "메인화면", href: "/" },
  { label: "계좌", href: "/account" },
  { label: "보고서", href: "/reports" },
  { label: "에이전트", href: "/agents" },
];

export const agentNavItems = agentDefinitions.map((agent) => ({
  label: agent.label,
  href: agent.path,
  description: agent.description,
}));

export const emptyPromptOverrides: PromptOverrides = {
  data_collection: "",
  data_analysis: "",
  risk_management: "",
  buy_sell: "",
  order_execution: "",
  log_evaluation: "",
};

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

export function runtimeLabel(runtime: RuntimeSummary) {
  const model = runtime.model_name ? ` / ${runtime.model_name}` : "";
  return `${runtime.data_mode} data / ${runtime.llm_mode}${model}`;
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
