"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TradeAction = "BUY" | "SELL" | "HOLD";
type RiskTolerance = "low" | "medium" | "high";
type AgentKey = "collection" | "analysis" | "risk" | "decision" | "order" | "evaluation";

type MarketData = {
  symbol: string;
  latest_price: number;
  news_headlines: string[];
  financial_metrics: Record<string, number>;
};

type AnalysisSignal = {
  symbol: string;
  price_score: number;
  news_score: number;
  financial_score: number;
  total_score: number;
  rationale: string;
};

type RiskAssessment = {
  symbol: string;
  approved: boolean;
  reasons: string[];
  max_position_weight: number;
};

type TradeDecision = {
  symbol: string;
  action: TradeAction;
  confidence: number;
  rationale: string;
  risk_approved: boolean;
};

type OrderPlan = {
  symbol: string;
  action: TradeAction;
  quantity: number;
  should_submit: boolean;
  reason: string;
};

type EvaluationLog = {
  decision_count: number;
  order_count: number;
  blocked_order_count: number;
  notes: string[];
};

type Mandate = {
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

type MandateViolation = {
  symbol: string;
  rule: string;
  message: string;
};

type DecisionResponse = {
  run_id: string;
  symbols: string[];
  mandate: Mandate;
  market_data: MarketData[];
  analysis_signals: AnalysisSignal[];
  risk_assessments: RiskAssessment[];
  decisions: TradeDecision[];
  orders: OrderPlan[];
  evaluation_log: EvaluationLog;
  mandate_violations: MandateViolation[];
};

type AgentTab = {
  key: AgentKey;
  label: string;
  role: string;
};

type InteractionMessage = {
  role: "user" | "agent";
  content: string;
  focus?: string;
  suggested_actions?: string[];
};

type AgentInteractionResponse = {
  focus: string;
  reply: string;
  suggested_actions: string[];
};

type PromptOverrides = {
  data_collection: string;
  data_analysis: string;
  risk_management: string;
  buy_sell: string;
  order_execution: string;
  log_evaluation: string;
};

type RuntimeSummary = {
  data_mode: string;
  llm_mode: string;
  model_name: string | null;
  live_order_enabled: boolean;
};

type ExperimentListItem = {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  symbols: string[];
  decision_actions: Record<string, TradeAction>;
  runtime: RuntimeSummary;
};

type ExperimentResponse = {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  decision: {
    symbols: string[];
    max_position_weight: number;
    mandate: Omit<Mandate, "max_position_weight"> | null;
  };
  prompt_overrides: PromptOverrides;
  runtime: RuntimeSummary;
  result: DecisionResponse;
};

type WorkMode = "decision" | "experiment";

const emptyPromptOverrides: PromptOverrides = {
  data_collection: "",
  data_analysis: "",
  risk_management: "",
  buy_sell: "",
  order_execution: "",
  log_evaluation: "",
};

const promptOverrideFields: { key: keyof PromptOverrides; label: string }[] = [
  { key: "data_collection", label: "데이터 수집" },
  { key: "data_analysis", label: "데이터 분석" },
  { key: "risk_management", label: "리스크 관리" },
  { key: "buy_sell", label: "매수/매도 판단" },
  { key: "order_execution", label: "주문 실행" },
  { key: "log_evaluation", label: "로그/평가" },
];

const agentTabs: AgentTab[] = [
  {
    key: "collection",
    label: "데이터 수집",
    role: "요청 종목을 정규화하고 가격, 뉴스, 재무 데이터를 수집합니다.",
  },
  {
    key: "analysis",
    label: "데이터 분석",
    role: "수집 데이터를 가격, 뉴스, 재무 점수와 분석 근거로 변환합니다.",
  },
  {
    key: "risk",
    label: "리스크 관리",
    role: "비중 제한과 투자 근거 유무를 확인해 승인 여부를 결정합니다.",
  },
  {
    key: "decision",
    label: "매수/매도 판단",
    role: "분석 점수와 리스크 승인 결과를 조합해 BUY, SELL, HOLD를 결정합니다.",
  },
  {
    key: "order",
    label: "주문 실행",
    role: "실제 주문 대신 제출 가능 여부와 수량이 포함된 주문 계획을 만듭니다.",
  },
  {
    key: "evaluation",
    label: "로그/평가",
    role: "판단 수, 주문 계획 수, 차단 주문 수와 요약 notes를 생성합니다.",
  },
];

const actionLabels: Record<TradeAction, string> = {
  BUY: "매수",
  SELL: "매도",
  HOLD: "보류",
};

function parseSymbols(value: string) {
  return value
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number) {
  return value.toFixed(2);
}

function formatMetrics(metrics: Record<string, number>) {
  const entries = Object.entries(metrics);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(" / ") : "없음";
}

function riskToleranceLabel(value: RiskTolerance) {
  if (value === "low") {
    return "낮음";
  }
  if (value === "high") {
    return "높음";
  }
  return "보통";
}

function runtimeLabel(runtime: RuntimeSummary) {
  const model = runtime.model_name ? ` / ${runtime.model_name}` : "";
  return `${runtime.data_mode} data / ${runtime.llm_mode}${model}`;
}

export default function Home() {
  const [workMode, setWorkMode] = useState<WorkMode>("decision");
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT");
  const [maxPositionWeight, setMaxPositionWeight] = useState("0.2");
  const [mandateObjective, setMandateObjective] = useState(
    "Evaluate requested US equity symbols conservatively.",
  );
  const [allowedSymbolsInput, setAllowedSymbolsInput] = useState("");
  const [excludedSymbolsInput, setExcludedSymbolsInput] = useState("");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [userNotes, setUserNotes] = useState("");
  const [experimentName, setExperimentName] = useState("Conservative prompt test");
  const [experimentDescription, setExperimentDescription] = useState("");
  const [promptOverrides, setPromptOverrides] = useState<PromptOverrides>(emptyPromptOverrides);
  const [experimentHistory, setExperimentHistory] = useState<ExperimentListItem[]>([]);
  const [currentExperiment, setCurrentExperiment] = useState<ExperimentResponse | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentKey>("collection");
  const [interactionInput, setInteractionInput] = useState("");
  const [interactionMessages, setInteractionMessages] = useState<InteractionMessage[]>([
    {
      role: "agent",
      content: "분석을 실행한 뒤 현재 결과에 대해 질문할 수 있습니다.",
      suggested_actions: ["왜 HOLD야?", "리스크 요약", "주문 계획 설명"],
    },
  ]);
  const [isInteracting, setIsInteracting] = useState(false);

  const symbols = useMemo(() => parseSymbols(symbolsInput), [symbolsInput]);
  const allowedSymbols = useMemo(() => parseSymbols(allowedSymbolsInput), [allowedSymbolsInput]);
  const excludedSymbols = useMemo(() => parseSymbols(excludedSymbolsInput), [excludedSymbolsInput]);
  const weight = Number(maxPositionWeight);
  const hasValidWeight = Number.isFinite(weight) && weight > 0 && weight <= 1;
  const isExperimentMode = workMode === "experiment";
  const canSubmit =
    symbols.length > 0 &&
    hasValidWeight &&
    !isLoading &&
    (!isExperimentMode || experimentName.trim().length > 0);
  const runStatus = isLoading ? "분석 중" : result ? "완료" : error ? "실패" : "대기";
  const runStatusClass = isLoading ? "loading" : result ? "done" : error ? "failed" : "idle";

  useEffect(() => {
    void loadExperimentHistory();
  }, []);

  function buildDecisionRequest() {
    return {
      symbols,
      max_position_weight: weight,
      mandate: {
        objective: mandateObjective.trim() || "Evaluate requested US equity symbols conservatively.",
        allowed_symbols: allowedSymbols,
        excluded_symbols: excludedSymbols,
        risk_tolerance: riskTolerance,
        requires_approval_for_live_orders: requiresApproval,
        user_notes: userNotes.trim(),
      },
    };
  }

  async function loadExperimentHistory() {
    setIsHistoryLoading(true);
    try {
      const response = await fetch("/api/experiments");
      if (!response.ok) {
        throw new Error(`실험 목록 요청 실패: ${response.status}`);
      }
      const data = (await response.json()) as ExperimentListItem[];
      setExperimentHistory(data);
    } catch {
      setExperimentHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function applyExperimentDetail(data: ExperimentResponse) {
    setCurrentExperiment(data);
    setResult(data.result);
    setSymbolsInput(data.decision.symbols.join(", "));
    setMaxPositionWeight(String(data.decision.max_position_weight));
    setExperimentName(data.name);
    setExperimentDescription(data.description);
    setPromptOverrides(data.prompt_overrides);

    const mandate = data.decision.mandate;
    if (mandate) {
      setMandateObjective(mandate.objective);
      setAllowedSymbolsInput(mandate.allowed_symbols.join(", "));
      setExcludedSymbolsInput(mandate.excluded_symbols.join(", "));
      setRiskTolerance(mandate.risk_tolerance);
      setRequiresApproval(mandate.requires_approval_for_live_orders);
      setUserNotes(mandate.user_notes);
    }
  }

  async function handleLoadExperiment(experimentId: string) {
    setError(null);
    try {
      const response = await fetch(`/api/experiments/${experimentId}`);
      if (!response.ok) {
        throw new Error(`실험 상세 요청 실패: ${response.status}`);
      }
      const data = (await response.json()) as ExperimentResponse;
      applyExperimentDetail(data);
      setWorkMode("experiment");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "실험을 불러오지 못했습니다.");
    }
  }

  function updatePromptOverride(key: keyof PromptOverrides, value: string) {
    setPromptOverrides((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const decisionRequest = buildDecisionRequest();
      const response = await fetch(isExperimentMode ? "/api/experiments" : "/api/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isExperimentMode
            ? {
                name: experimentName.trim(),
                description: experimentDescription.trim(),
                decision: decisionRequest,
                prompt_overrides: promptOverrides,
              }
            : decisionRequest,
        ),
      });

      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }

      if (isExperimentMode) {
        const data = (await response.json()) as ExperimentResponse;
        applyExperimentDetail(data);
        void loadExperimentHistory();
        setInteractionMessages([
          {
            role: "agent",
            content: `${data.name} 실험이 저장됐습니다. 판단, 리스크, 주문 계획 중 궁금한 내용을 물어보세요.`,
            suggested_actions: ["결과 요약", "프롬프트 영향 설명", "주문 차단 이유"],
          },
        ]);
      } else {
        const data = (await response.json()) as DecisionResponse;
        setCurrentExperiment(null);
        setResult(data);
        setInteractionMessages([
          {
            role: "agent",
            content: `${data.symbols.join(", ")} 분석이 끝났습니다. 판단, 리스크, 주문 계획 중 궁금한 내용을 물어보세요.`,
            suggested_actions: ["결과 요약", "왜 이런 판단이야?", "리스크를 설명해줘"],
          },
        ]);
      }
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInteractionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = interactionInput.trim();
    if (!message || isInteracting) {
      return;
    }

    setInteractionInput("");
    setIsInteracting(true);
    setInteractionMessages((messages) => [...messages, { role: "user", content: message }]);

    try {
      const response = await fetch("/api/console/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result ? { message, run_id: result.run_id } : { message }),
      });

      if (!response.ok) {
        throw new Error(`메인 에이전트 요청 실패: ${response.status}`);
      }

      const data = (await response.json()) as AgentInteractionResponse;
      setInteractionMessages((messages) => [
        ...messages,
        {
          role: "agent",
          content: data.reply,
          focus: data.focus,
          suggested_actions: data.suggested_actions,
        },
      ]);
    } catch (requestError) {
      setInteractionMessages((messages) => [
        ...messages,
        {
          role: "agent",
          content:
            requestError instanceof Error
              ? requestError.message
              : "메인 에이전트 응답을 가져오지 못했습니다.",
        },
      ]);
    } finally {
      setIsInteracting(false);
    }
  }

  function getAgentStatus(key: AgentKey) {
    if (isLoading) {
      return "실행 중";
    }
    if (!result) {
      return "대기";
    }
    if (key === "order" && result.orders.every((order) => !order.should_submit)) {
      return "계획 완료";
    }
    return "완료";
  }

  function renderAgentDetail() {
    if (!result) {
      return (
        <div className="empty-state agent-empty">
          <h3>에이전트 실행 대기</h3>
          <p>분석을 실행하면 각 에이전트의 입력, 출력, 판단 근거가 이 영역에 표시됩니다.</p>
        </div>
      );
    }

    if (activeAgent === "collection") {
      return (
        <div className="agent-detail-list">
          {result.market_data.map((data) => (
            <article className="agent-detail-row" key={data.symbol}>
              <div>
                <strong>{data.symbol}</strong>
                <span>가격 {data.latest_price}</span>
              </div>
              <p>뉴스: {data.news_headlines.length ? data.news_headlines.join(" / ") : "없음"}</p>
              <small>재무 지표: {formatMetrics(data.financial_metrics)}</small>
            </article>
          ))}
        </div>
      );
    }

    if (activeAgent === "analysis") {
      return (
        <div className="agent-detail-list">
          {result.analysis_signals.map((signal) => (
            <article className="agent-detail-row" key={signal.symbol}>
              <div>
                <strong>{signal.symbol}</strong>
                <span>종합 {formatScore(signal.total_score)}</span>
              </div>
              <div className="score-strip">
                <span>가격 {formatScore(signal.price_score)}</span>
                <span>뉴스 {formatScore(signal.news_score)}</span>
                <span>재무 {formatScore(signal.financial_score)}</span>
              </div>
              <p>{signal.rationale}</p>
            </article>
          ))}
        </div>
      );
    }

    if (activeAgent === "risk") {
      return (
        <div className="agent-detail-list">
          {result.risk_assessments.map((risk) => (
            <article className="agent-detail-row" key={risk.symbol}>
              <div>
                <strong>{risk.symbol}</strong>
                <span>{risk.approved ? "승인" : "거절"}</span>
              </div>
              <p>{risk.reasons.join(" / ")}</p>
              <small>적용한 최대 종목 비중: {formatPercent(risk.max_position_weight)}</small>
            </article>
          ))}
        </div>
      );
    }

    if (activeAgent === "decision") {
      return (
        <div className="agent-detail-list">
          {result.decisions.map((decision) => (
            <article className="agent-detail-row" key={decision.symbol}>
              <div>
                <strong>{decision.symbol}</strong>
                <span>{actionLabels[decision.action]}</span>
              </div>
              <div className="score-strip">
                <span>신뢰도 {formatScore(decision.confidence)}</span>
                <span>{decision.risk_approved ? "리스크 승인 기반" : "리스크 미승인으로 HOLD"}</span>
              </div>
              <p>{decision.rationale}</p>
            </article>
          ))}
        </div>
      );
    }

    if (activeAgent === "order") {
      return (
        <div className="agent-detail-list">
          {result.orders.map((order) => (
            <article className="agent-detail-row" key={order.symbol}>
              <div>
                <strong>{order.symbol}</strong>
                <span>{order.should_submit ? "제출 가능" : "제출 불가"}</span>
              </div>
              <div className="score-strip">
                <span>동작 {actionLabels[order.action]}</span>
                <span>수량 {order.quantity}</span>
              </div>
              <p>{order.reason}</p>
              <small>현재는 실제 브로커 주문을 전송하지 않습니다.</small>
            </article>
          ))}
        </div>
      );
    }

    return (
      <div className="agent-detail-list">
        <article className="agent-detail-row">
          <div>
            <strong>워크플로우 요약</strong>
            <span>완료</span>
          </div>
          <div className="score-strip">
            <span>판단 {result.evaluation_log.decision_count}</span>
            <span>주문 계획 {result.evaluation_log.order_count}</span>
            <span>차단 {result.evaluation_log.blocked_order_count}</span>
          </div>
          <p>{result.evaluation_log.notes.join(" / ")}</p>
        </article>
      </div>
    );
  }

  const currentAgent = agentTabs.find((agent) => agent.key === activeAgent) ?? agentTabs[0];

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <span className="eyebrow">Investment Console</span>
          <h1>agent-pay-for-urself</h1>
          <p>종목 입력부터 판단, 리스크 검증, 주문 계획까지 한 화면에서 확인합니다.</p>
        </div>
        <div className={`status status-${runStatusClass}`}>
          <span>상태</span>
          <strong>{runStatus}</strong>
        </div>
      </section>

      <section className="mode-switch" aria-label="작업 모드">
        <button
          className={workMode === "decision" ? "mode-button mode-button-active" : "mode-button"}
          onClick={() => setWorkMode("decision")}
          type="button"
        >
          분석
        </button>
        <button
          className={workMode === "experiment" ? "mode-button mode-button-active" : "mode-button"}
          onClick={() => setWorkMode("experiment")}
          type="button"
        >
          실험실
        </button>
      </section>

      <section className="console-layout">
        <form className="control-panel" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{isExperimentMode ? "실험 조건" : "분석 조건"}</h2>
            <p>실데이터와 모델이 설정되면 사용하고, 없으면 stub/fallback으로 실행합니다.</p>
          </div>

          {isExperimentMode ? (
            <div className="experiment-panel">
              <label className="field">
                <span>실험 이름</span>
                <input
                  type="text"
                  value={experimentName}
                  onChange={(event) => setExperimentName(event.target.value)}
                  placeholder="예: 보수형 리스크 프롬프트"
                />
              </label>
              <label className="field">
                <span>실험 설명</span>
                <textarea
                  value={experimentDescription}
                  onChange={(event) => setExperimentDescription(event.target.value)}
                  placeholder="이번 실험에서 검증할 전략, 프롬프트 의도, 관찰 포인트"
                />
              </label>
            </div>
          ) : null}

          <label className="field">
            <span>종목</span>
            <input
              type="text"
              value={symbolsInput}
              onChange={(event) => setSymbolsInput(event.target.value)}
              placeholder="AAPL, MSFT"
            />
          </label>

          <label className="field">
            <span>최대 종목 비중</span>
            <input
              type="number"
              min="0.01"
              max="1"
              step="0.01"
              value={maxPositionWeight}
              onChange={(event) => setMaxPositionWeight(event.target.value)}
            />
          </label>

          <div className="mandate-panel">
            <div className="section-heading compact">
              <h3>Mandate</h3>
              <p>메인 에이전트가 벗어나면 안 되는 실행 경계입니다.</p>
            </div>

            <label className="field">
              <span>목표</span>
              <input
                type="text"
                value={mandateObjective}
                onChange={(event) => setMandateObjective(event.target.value)}
              />
            </label>

            <label className="field">
              <span>허용 종목</span>
              <input
                type="text"
                value={allowedSymbolsInput}
                onChange={(event) => setAllowedSymbolsInput(event.target.value)}
                placeholder="비워두면 요청 종목 허용"
              />
            </label>

            <label className="field">
              <span>제외 종목</span>
              <input
                type="text"
                value={excludedSymbolsInput}
                onChange={(event) => setExcludedSymbolsInput(event.target.value)}
                placeholder="TSLA, NVDA"
              />
            </label>

            <label className="field">
              <span>위험 성향</span>
              <select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as RiskTolerance)}>
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(event) => setRequiresApproval(event.target.checked)}
              />
              <span>실주문 전 사용자 승인 필요</span>
            </label>

            <label className="field">
              <span>추가 조건</span>
              <textarea
                value={userNotes}
                onChange={(event) => setUserNotes(event.target.value)}
                placeholder="예: 대형주 위주, 변동성 높은 종목 제외"
              />
            </label>
          </div>

          {isExperimentMode ? (
            <div className="prompt-panel">
              <div className="section-heading compact">
                <h3>에이전트별 프롬프트 오버라이드</h3>
                <p>기본 출력 스키마와 안전 제약보다 우선하지 않는 추가 실험 지시입니다.</p>
              </div>
              {promptOverrideFields.map((field) => (
                <label className="field" key={field.key}>
                  <span>{field.label}</span>
                  <textarea
                    value={promptOverrides[field.key]}
                    onChange={(event) => updatePromptOverride(field.key, event.target.value)}
                    placeholder={`${field.label} 에이전트에만 적용할 추가 지시`}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="request-preview">
            <span>요청 종목</span>
            <strong>{symbols.length ? symbols.join(", ") : "없음"}</strong>
            <span>비중 제한</span>
            <strong>{hasValidWeight ? formatPercent(weight) : "유효하지 않음"}</strong>
            <span>Mandate 허용</span>
            <strong>{allowedSymbols.length ? allowedSymbols.join(", ") : "요청 종목"}</strong>
            <span>Mandate 제외</span>
            <strong>{excludedSymbols.length ? excludedSymbols.join(", ") : "없음"}</strong>
          </div>

          <button type="submit" disabled={!canSubmit}>
            {isLoading ? "분석 중" : isExperimentMode ? "실험 실행 및 저장" : "분석 실행"}
          </button>

          {error ? <p className="error-message">{error}</p> : null}

          {isExperimentMode ? (
            <section className="history-panel">
              <div className="section-heading compact">
                <h3>저장된 실험</h3>
                <p>{isHistoryLoading ? "불러오는 중" : `${experimentHistory.length}개 저장됨`}</p>
              </div>
              <div className="history-list">
                {experimentHistory.length ? (
                  experimentHistory.map((experiment) => (
                    <button
                      className="history-item"
                      key={experiment.experiment_id}
                      onClick={() => void handleLoadExperiment(experiment.experiment_id)}
                      type="button"
                    >
                      <strong>{experiment.name}</strong>
                      <span>{experiment.symbols.join(", ") || "종목 없음"}</span>
                      <small>{runtimeLabel(experiment.runtime)}</small>
                    </button>
                  ))
                ) : (
                  <p>아직 저장된 실험이 없습니다.</p>
                )}
              </div>
            </section>
          ) : null}
        </form>

        <section className="results-panel">
          {!result ? (
            <div className="empty-state">
              <h2>분석 결과 대기</h2>
              <p>종목과 비중을 입력한 뒤 분석을 실행하면 판단 결과가 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <h2>판단 요약</h2>
                <p>{result.symbols.join(", ")} 요청 결과</p>
              </div>

              {currentExperiment ? (
                <section className="experiment-summary">
                  <div>
                    <span>Experiment</span>
                    <strong>{currentExperiment.name}</strong>
                    <p>{currentExperiment.description || "설명 없음"}</p>
                  </div>
                  <div className="mandate-chips">
                    <span>ID {currentExperiment.experiment_id}</span>
                    <span>Run {currentExperiment.run_id}</span>
                    <span>{runtimeLabel(currentExperiment.runtime)}</span>
                    <span>{currentExperiment.runtime.live_order_enabled ? "실험 주문 허용 env" : "실험 주문 차단"}</span>
                  </div>
                </section>
              ) : null}

              <section className="mandate-summary">
                <div>
                  <span>Mandate</span>
                  <strong>{result.mandate.objective}</strong>
                </div>
                <div className="mandate-chips">
                  <span>위험 성향 {riskToleranceLabel(result.mandate.risk_tolerance)}</span>
                  <span>최대 비중 {formatPercent(result.mandate.max_position_weight)}</span>
                  <span>{result.mandate.requires_approval_for_live_orders ? "승인 필요" : "자동 제출 허용"}</span>
                </div>
                {result.mandate_violations.length ? (
                  <div className="violation-list">
                    {result.mandate_violations.map((violation) => (
                      <p key={`${violation.symbol}-${violation.rule}`}>
                        {violation.symbol}: {violation.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </section>

              <div className="decision-list">
                {result.decisions.map((decision) => (
                  <article className="decision-row" key={decision.symbol}>
                    <div>
                      <span className="symbol">{decision.symbol}</span>
                      <strong className={`action action-${decision.action}`}>
                        {actionLabels[decision.action]}
                      </strong>
                    </div>
                    <div className="metric-line">
                      <span>신뢰도 {formatScore(decision.confidence)}</span>
                      <span>{decision.risk_approved ? "리스크 승인" : "리스크 미승인"}</span>
                    </div>
                    <p>{decision.rationale}</p>
                  </article>
                ))}
              </div>

              <div className="data-grid">
                <section className="table-section">
                  <h3>분석 점수</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>종목</th>
                          <th>가격</th>
                          <th>뉴스</th>
                          <th>재무</th>
                          <th>종합</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.analysis_signals.map((signal) => (
                          <tr key={signal.symbol}>
                            <td>{signal.symbol}</td>
                            <td>{formatScore(signal.price_score)}</td>
                            <td>{formatScore(signal.news_score)}</td>
                            <td>{formatScore(signal.financial_score)}</td>
                            <td>{formatScore(signal.total_score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="table-section">
                  <h3>리스크 검증</h3>
                  <div className="risk-list">
                    {result.risk_assessments.map((risk) => (
                      <article className="risk-row" key={risk.symbol}>
                        <div>
                          <strong>{risk.symbol}</strong>
                          <span>{risk.approved ? "승인" : "거절"}</span>
                        </div>
                        <p>{risk.reasons.join(" / ")}</p>
                        <small>최대 비중 {formatPercent(risk.max_position_weight)}</small>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <section className="table-section order-section">
                <div className="section-heading compact">
                  <h3>주문 계획</h3>
                  <p>현재 주문 계획은 실제 주문 전송이 아닙니다.</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>종목</th>
                        <th>동작</th>
                        <th>수량</th>
                        <th>제출 가능</th>
                        <th>사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.orders.map((order) => (
                        <tr key={order.symbol}>
                          <td>{order.symbol}</td>
                          <td>{actionLabels[order.action]}</td>
                          <td>{order.quantity}</td>
                          <td>{order.should_submit ? "가능" : "불가"}</td>
                          <td>{order.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </section>
      </section>

      <section className="main-agent-panel">
        <div className="section-heading">
          <h2>Main Agent</h2>
          <p>현재 분석 결과를 기준으로 요약, 판단 근거, 리스크, 주문 계획을 질의합니다.</p>
        </div>
        <div className="interaction-log" aria-live="polite">
          {interactionMessages.map((message, index) => (
            <article className={`message message-${message.role}`} key={`${message.role}-${index}`}>
              <span>{message.role === "agent" ? "Main Agent" : "User"}</span>
              <p>{message.content}</p>
              {message.suggested_actions?.length ? (
                <div className="suggestion-row">
                  {message.suggested_actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => setInteractionInput(action)}
                      type="button"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <form className="interaction-form" onSubmit={handleInteractionSubmit}>
          <input
            type="text"
            value={interactionInput}
            onChange={(event) => setInteractionInput(event.target.value)}
            placeholder="예: 왜 AAPL은 HOLD야?"
          />
          <button type="submit" disabled={!interactionInput.trim() || isInteracting}>
            {isInteracting ? "응답 중" : "질문"}
          </button>
        </form>
      </section>

      <section className="agent-strip">
        {agentTabs.map((agent) => (
          <button
            className={`agent-card ${activeAgent === agent.key ? "agent-card-active" : ""}`}
            key={agent.key}
            onClick={() => setActiveAgent(agent.key)}
            type="button"
          >
            <span>{agent.label}</span>
            <strong>{getAgentStatus(agent.key)}</strong>
          </button>
        ))}
      </section>

      <section className="agent-monitor">
        <div className="section-heading">
          <h2>에이전트 모니터</h2>
          <p>각 단계가 이번 요청에서 어떤 입력을 보고 어떤 근거로 산출물을 만들었는지 확인합니다.</p>
        </div>
        <div className="agent-tabs" role="tablist" aria-label="Agent details">
          {agentTabs.map((agent) => (
            <button
              aria-selected={activeAgent === agent.key}
              className={`tab-button ${activeAgent === agent.key ? "tab-button-active" : ""}`}
              key={agent.key}
              onClick={() => setActiveAgent(agent.key)}
              role="tab"
              type="button"
            >
              {agent.label}
            </button>
          ))}
        </div>
        <section className="agent-detail-panel">
          <div className="agent-detail-header">
            <div>
              <span>{currentAgent.label}</span>
              <h3>{getAgentStatus(currentAgent.key)}</h3>
            </div>
            <p>{currentAgent.role}</p>
          </div>
          {renderAgentDetail()}
        </section>
      </section>
    </main>
  );
}
