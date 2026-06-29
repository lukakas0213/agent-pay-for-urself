"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AgentInteractionResponse,
  DecisionRequest,
  DecisionResponse,
  FrontendWorkspaceSettings,
  RiskTolerance,
  actionLabel,
  agentDefinitions,
  fetchJson,
  formatDateTime,
  formatMetrics,
  formatPercent,
  formatScore,
  loadFrontendWorkspaceSettings,
  normalizeDecisionResponse,
  parseSymbols,
  runtimeLabel,
  saveFrontendWorkspaceSettings,
} from "../lib/workspace";

type ExperimentSaveRequest = {
  run_id: string;
  name: string;
  description: string;
};

type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
};

type TimelineEntry = {
  id: string;
  title: string;
  detail: string;
  status: "running" | "connected" | "disconnected";
  timestamp: string;
};

const RESULT_STORAGE_KEY = "latest-workflow-result";
const CHAT_STORAGE_KEY = "workflow-chat-history";
const TIMELINE_STORAGE_KEY = "workflow-timeline-history";

function buildDecisionRequest(
  symbols: string[],
  maxPositionWeight: number,
  userPrompt: string,
  allowedSymbols: string[],
  excludedSymbols: string[],
  riskTolerance: RiskTolerance,
  autoTradingEnabled: boolean,
  userNotes: string,
  chatMessages: string[],
): DecisionRequest {
  return {
    symbols,
    max_position_weight: maxPositionWeight,
    user_prompt: userPrompt.trim(),
    chat_messages: chatMessages,
    mandate: {
      objective: userPrompt.trim() || "채팅 지시를 기반으로 요청 종목을 점검한다.",
      allowed_symbols: allowedSymbols,
      excluded_symbols: excludedSymbols,
      max_order_notional: null,
      min_cash_weight: null,
      risk_tolerance: riskTolerance,
      requires_approval_for_live_orders: !autoTradingEnabled,
      user_notes: userNotes.trim(),
    },
  };
}

function nowIso() {
  return new Date().toISOString();
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveStoredJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
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

function statusLabel(status: TimelineEntry["status"]) {
  if (status === "running") {
    return "러닝중";
  }
  if (status === "connected") {
    return "연결됨";
  }
  return "연결안됨";
}

function buildAssistantSummary(result: DecisionResponse) {
  const summary = result.supervisor_directive.summary || "요약 없음";
  const decisions = result.decisions.map((decision) => `${decision.symbol} ${actionLabel(decision.action)}`).join(", ");
  return `실행이 끝났습니다. 메인 요약은 “${summary}”이고 현재 판단은 ${decisions || "없음"}입니다.`;
}

function agentStatusText(result: DecisionResponse | null, loading: boolean, agentKey: string) {
  if (loading) {
    return "러닝중";
  }
  if (!result) {
    return "연결안됨";
  }
  if (agentKey === "order_execution") {
    return result.orders.some((item) => item.should_submit) ? "연결됨" : "연결됨";
  }
  return "연결됨";
}

export function WorkflowHome() {
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT");
  const [maxPositionWeight, setMaxPositionWeight] = useState("0.2");
  const [userPrompt, setUserPrompt] = useState("메인 에이전트가 채팅 지시를 반영해 보수적으로 종목을 검토한다.");
  const [allowedSymbolsInput, setAllowedSymbolsInput] = useState("");
  const [excludedSymbolsInput, setExcludedSymbolsInput] = useState("");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [saveName, setSaveName] = useState("최근 실행 보고서");
  const [saveDescription, setSaveDescription] = useState("");
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextSettings = loadFrontendWorkspaceSettings();
    setSettings(nextSettings);
    setSymbolsInput(nextSettings.default_symbols);
    setMaxPositionWeight(nextSettings.default_max_position_weight);
    setRiskTolerance(nextSettings.default_risk_tolerance);
    setAutoTradingEnabled(nextSettings.auto_trading_enabled);

    const storedResult = normalizeDecisionResponse(loadStoredJson<DecisionResponse>(RESULT_STORAGE_KEY));
    if (storedResult) {
      setResult(storedResult);
    }

    const storedChat = loadStoredJson<ChatEntry[]>(CHAT_STORAGE_KEY);
    if (storedChat) {
      setChatEntries(storedChat);
    }

    const storedTimeline = loadStoredJson<TimelineEntry[]>(TIMELINE_STORAGE_KEY);
    if (storedTimeline) {
      setTimelineEntries(storedTimeline);
    }
  }, []);

  const symbols = useMemo(() => parseSymbols(symbolsInput), [symbolsInput]);
  const allowedSymbols = useMemo(() => parseSymbols(allowedSymbolsInput), [allowedSymbolsInput]);
  const excludedSymbols = useMemo(() => parseSymbols(excludedSymbolsInput), [excludedSymbolsInput]);
  const weight = Number(maxPositionWeight);
  const hasValidWeight = Number.isFinite(weight) && weight > 0 && weight <= 1;
  const canRun = symbols.length > 0 && hasValidWeight && !isLoading;
  const canSave = Boolean(result && saveName.trim() && !isSaving);
  const timelineLimit = settings?.timeline_limit ?? 12;

  function persistSettings(nextSettings: FrontendWorkspaceSettings) {
    setSettings(nextSettings);
    saveFrontendWorkspaceSettings(nextSettings);
  }

  function persistResult(nextResult: DecisionResponse) {
    const normalizedResult = normalizeDecisionResponse(nextResult);
    if (!normalizedResult) {
      return;
    }
    setResult(normalizedResult);
    saveStoredJson(RESULT_STORAGE_KEY, normalizedResult);
  }

  function persistChat(nextChat: ChatEntry[]) {
    setChatEntries(nextChat);
    saveStoredJson(CHAT_STORAGE_KEY, nextChat);
  }

  function persistTimeline(nextTimeline: TimelineEntry[]) {
    setTimelineEntries(nextTimeline);
    saveStoredJson(TIMELINE_STORAGE_KEY, nextTimeline);
  }

  function appendTimeline(entry: Omit<TimelineEntry, "id" | "timestamp">) {
    const currentTimeline = loadStoredJson<TimelineEntry[]>(TIMELINE_STORAGE_KEY) ?? timelineEntries;
    const nextTimeline = [
      {
        id: buildId("timeline"),
        timestamp: nowIso(),
        ...entry,
      },
      ...currentTimeline,
    ].slice(0, timelineLimit);
    persistTimeline(nextTimeline);
  }

  function appendChat(entry: Omit<ChatEntry, "id" | "timestamp">) {
    const currentChat = loadStoredJson<ChatEntry[]>(CHAT_STORAGE_KEY) ?? chatEntries;
    const nextChat = [
      ...currentChat,
      {
        id: buildId("chat"),
        timestamp: nowIso(),
        ...entry,
      },
    ];
    persistChat(nextChat);
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSaveMessage(null);
    appendTimeline({
      title: "메인 에이전트 실행 시작",
      detail: `${symbols.join(", ")} 기준으로 워크플로우를 시작했습니다.`,
      status: "running",
    });

    try {
      const payload = buildDecisionRequest(
        symbols,
        weight,
        userPrompt,
        allowedSymbols,
        excludedSymbols,
        riskTolerance,
        autoTradingEnabled,
        userNotes,
        chatEntries.filter((entry) => entry.role === "user").map((entry) => entry.content),
      );
      const data = await fetchJson<DecisionResponse>("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      persistResult(data);
      appendChat({ role: "assistant", content: buildAssistantSummary(data) });
      appendTimeline({
        title: "에이전트 실행 완료",
        detail: data.supervisor_directive.summary || `${data.symbols.join(", ")} 분석이 완료되었습니다.`,
        status: "connected",
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "실행 중 오류가 발생했습니다.";
      setError(message);
      appendTimeline({
        title: "에이전트 실행 실패",
        detail: message,
        status: "disconnected",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message || isChatLoading) {
      return;
    }

    setChatDraft("");
    setError(null);
    appendChat({ role: "user", content: message });
    setIsChatLoading(true);

    try {
      const response = await fetchJson<AgentInteractionResponse>("/api/console/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          run_id: result?.run_id ?? null,
          current_result: result,
          apply_to_workflow: Boolean(result && settings?.auto_apply_chat_followups),
        }),
      });

      appendChat({ role: "assistant", content: response.reply });
      appendTimeline({
        title: response.applied_to_workflow ? "채팅 지시를 반영해 재실행" : "메인 에이전트 답변 수신",
        detail: response.reply,
        status: response.applied_to_workflow ? "running" : "connected",
      });

      if (response.updated_result) {
        persistResult(response.updated_result);
        appendTimeline({
          title: "후속 지시 반영 완료",
          detail: response.updated_result.supervisor_directive.summary || "업데이트된 워크플로우 결과가 저장되었습니다.",
          status: "connected",
        });
      }
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "채팅 요청에 실패했습니다.";
      setError(messageText);
      appendChat({ role: "system", content: messageText });
      appendTimeline({
        title: "채팅 요청 실패",
        detail: messageText,
        status: "disconnected",
      });
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleSaveExperiment() {
    if (!result || !canSave) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload: ExperimentSaveRequest = {
        run_id: result.run_id,
        name: saveName.trim(),
        description: saveDescription.trim(),
      };
      await fetchJson("/api/experiments/from-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaveMessage("실행 결과를 보고서 메뉴에 저장했습니다.");
      appendTimeline({
        title: "보고서 저장 완료",
        detail: `${saveName.trim()} 이름으로 최근 실행을 저장했습니다.`,
        status: "connected",
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "저장에 실패했습니다.";
      setSaveMessage(message);
      appendTimeline({
        title: "보고서 저장 실패",
        detail: message,
        status: "disconnected",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleToggleAutoTrading(checked: boolean) {
    setAutoTradingEnabled(checked);
    if (!settings) {
      return;
    }
    persistSettings({ ...settings, auto_trading_enabled: checked });
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">메인화면</span>
          <h1>메인 에이전트 채팅과 자동매매 승인 허브</h1>
          <p>
            채팅으로 메인 에이전트에 지시를 보내고, 자동매매 승인 상태를 확인한 뒤, 같은 화면에서
            타임라인과 주문 전 보고서를 이어서 확인합니다.
          </p>
          <div className="hero-steps">
            <div className="step-chip">1. 채팅으로 지시</div>
            <div className="step-chip">2. 워크플로우 실행</div>
            <div className="step-chip">3. 타임라인과 보고서 확인</div>
          </div>
        </div>
        <div className="status-card switch-card">
          <span>자동매매 승인 스위치</span>
          <strong>{autoTradingEnabled ? "승인됨" : "수동 승인"}</strong>
          <label className="toggle-field toggle-card">
            <input
              checked={autoTradingEnabled}
              onChange={(event) => handleToggleAutoTrading(event.target.checked)}
              type="checkbox"
            />
            자동매매 승인
          </label>
          <small>{result ? runtimeLabel(result.runtime) : "실행 후 런타임이 표시됩니다."}</small>
        </div>
      </section>

      <section className="dashboard-grid workspace-overview-grid">
        <article className="panel panel-wide command-center-panel">
          <div className="section-heading compact">
            <span className="eyebrow">메인 에이전트</span>
            <h2>채팅과 실행 조건을 한 번에 관리</h2>
          </div>
          <div className="command-center-grid">
            <div className="chat-lane">
              <div className="chat-panel">
                <div className="chat-header">
                  <div>
                    <h3>메인 에이전트 채팅</h3>
                    <p>실행 전에는 방향을 주고, 실행 후에는 후속 지시를 바로 반영할 수 있습니다.</p>
                  </div>
                  <small>{settings?.auto_apply_chat_followups ? "후속 채팅 자동 재실행" : "설정 페이지에서 자동 재실행 가능"}</small>
                </div>
                <div className="chat-transcript">
                  {chatEntries.length ? (
                    chatEntries.map((entry) => (
                      <article className={`chat-bubble chat-bubble-${entry.role}`} key={entry.id}>
                        <span className="chat-role">{entry.role === "user" ? "나" : entry.role === "assistant" ? "메인 에이전트" : "시스템"}</span>
                        <p>{entry.content}</p>
                        <small className="chat-meta">{formatDateTime(entry.timestamp)}</small>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state compact-empty">
                      <h3>아직 채팅 기록이 없습니다</h3>
                      <p>예: “애플 비중은 낮게 보고, 엔비디아는 관찰 종목으로만 남겨줘.”</p>
                    </div>
                  )}
                </div>
                <form className="chat-compose" onSubmit={handleSendChat}>
                  <textarea
                    placeholder="메인 에이전트에게 지시할 내용을 입력하세요"
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                  />
                  <button disabled={isChatLoading || !chatDraft.trim()} type="submit">
                    {isChatLoading ? "응답 대기 중..." : "채팅 보내기"}
                  </button>
                </form>
              </div>
            </div>

            <form className="stack-form" onSubmit={handleRun}>
              <div className="form-section">
                <div className="form-section-heading">
                  <h3>실행 기본값</h3>
                  <p>심볼, 최대 비중, 메인 목표를 먼저 정합니다.</p>
                </div>
                <div className="form-grid two-cols">
                  <label className="field">
                    <span>심볼</span>
                    <input value={symbolsInput} onChange={(event) => setSymbolsInput(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>최대 비중</span>
                    <input
                      inputMode="decimal"
                      value={maxPositionWeight}
                      onChange={(event) => setMaxPositionWeight(event.target.value)}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>메인 목표</span>
                  <textarea value={userPrompt} onChange={(event) => setUserPrompt(event.target.value)} />
                </label>
              </div>

              <div className="form-section subtle-section">
                <div className="form-section-heading">
                  <h3>세부 제약</h3>
                  <p>허용/제외 심볼과 리스크 성향, 추가 메모를 설정합니다.</p>
                </div>
                <div className="form-grid two-cols">
                  <label className="field">
                    <span>허용 심볼</span>
                    <input value={allowedSymbolsInput} onChange={(event) => setAllowedSymbolsInput(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>제외 심볼</span>
                    <input value={excludedSymbolsInput} onChange={(event) => setExcludedSymbolsInput(event.target.value)} />
                  </label>
                </div>
                <div className="form-grid two-cols">
                  <label className="field">
                    <span>리스크 성향</span>
                    <select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as RiskTolerance)}>
                      <option value="low">낮음</option>
                      <option value="medium">보통</option>
                      <option value="high">높음</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>자동매매 승인 상태</span>
                    <input readOnly value={autoTradingEnabled ? "승인됨" : "수동 승인 필요"} />
                  </label>
                </div>
                <label className="field">
                  <span>추가 메모</span>
                  <textarea value={userNotes} onChange={(event) => setUserNotes(event.target.value)} />
                </label>
              </div>

              <div className="action-row">
                <button disabled={!canRun} type="submit">
                  {isLoading ? "실행 중..." : "워크플로우 실행"}
                </button>
                <small>
                  {canRun ? "채팅 지시와 실행 조건이 준비되었습니다." : "심볼과 최대 비중 형식을 확인하세요."}
                </small>
              </div>
              {error ? <p className="inline-error">{error}</p> : null}
            </form>
          </div>
        </article>

        <aside className="panel secondary-guide-panel">
          <div className="section-heading compact">
            <span className="eyebrow">에이전트 상태</span>
            <h2>러닝중, 연결됨, 연결안됨</h2>
          </div>
          <div className="agent-health-grid">
            {agentDefinitions.map((agent) => (
              <article className="status-chip" key={agent.key}>
                <div>
                  <strong>{agent.label}</strong>
                  <span>{agent.description}</span>
                </div>
                <small>{agentStatusText(result, isLoading, agent.key)}</small>
              </article>
            ))}
          </div>
          <div className="runtime-block">
            <span>현재 조건</span>
            <strong>{symbols.length ? symbols.join(", ") : "입력 필요"}</strong>
            <small>리스크 {riskToleranceLabel(riskTolerance)} / 최대 비중 {hasValidWeight ? formatPercent(weight) : "형식 확인 필요"}</small>
          </div>
          {result ? (
            <div className="directive-card">
              <span>메인 에이전트 요약</span>
              <strong>{result.supervisor_directive.summary || "요약 없음"}</strong>
              <small>watch: {result.supervisor_directive.watch_symbols.join(", ") || "없음"}</small>
            </div>
          ) : null}
        </aside>

        <article className="panel panel-wide panel-span-2">
          <div className="section-heading compact">
            <span className="eyebrow">에이전트 히스토리</span>
            <h2>자율 실행 타임라인</h2>
          </div>
          <div className="timeline-layout">
            <div className="timeline-list">
              {timelineEntries.length ? (
                timelineEntries.map((entry) => (
                  <article className="timeline-item" key={entry.id}>
                    <div className={`timeline-dot timeline-dot-${entry.status}`} />
                    <div className="timeline-content">
                      <div className="timeline-head">
                        <strong>{entry.title}</strong>
                        <span className="timeline-status">{statusLabel(entry.status)}</span>
                      </div>
                      <p>{entry.detail}</p>
                      <small>{formatDateTime(entry.timestamp)}</small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state compact-empty">
                  <h3>기록된 타임라인이 없습니다</h3>
                  <p>실행, 채팅, 저장 이벤트가 발생하면 이곳에 순서대로 쌓입니다.</p>
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="panel panel-wide panel-span-2">
          <div className="section-heading compact">
            <span className="eyebrow">주문 전 보고서</span>
            <h2>데이터 수집, 분석, 보고서 작성 결과를 먼저 검토</h2>
          </div>
          {result ? (
            <>
              <div className="execution-strip">
                <article className="execution-step">
                  <span>데이터 수집</span>
                  <strong>{result.market_data.length}개</strong>
                </article>
                <article className="execution-step">
                  <span>데이터 분석</span>
                  <strong>{result.analysis_signals.length}개</strong>
                </article>
                <article className="execution-step">
                  <span>보고서 작성</span>
                  <strong>{result.investment_reports.length}개</strong>
                </article>
                <article className="execution-step">
                  <span>주문 계획</span>
                  <strong>{result.orders.length}개</strong>
                </article>
              </div>
              <div className="report-preview-grid">
                {result.investment_reports.map((report) => (
                  <article className="report-insight-card" key={report.symbol}>
                    <div className="report-insight-head">
                      <div>
                        <span>{report.symbol}</span>
                        <strong>{report.risk_approved ? "리스크 승인" : "리스크 보류"}</strong>
                      </div>
                      <small>{actionLabel(report.recommended_action_bias)} · {formatScore(report.signal_strength)}</small>
                    </div>
                    <p>{report.summary}</p>
                    <small>최대 비중 {formatPercent(report.max_position_weight)}</small>
                    <div className="report-points">
                      <div>
                        <span>상승 포인트</span>
                        <small>{report.bull_points.join(" / ") || "없음"}</small>
                      </div>
                      <div>
                        <span>주의 포인트</span>
                        <small>{report.bear_points.join(" / ") || "없음"}</small>
                      </div>
                    </div>
                    <small className="report-flags">{report.risk_flags.join(" / ") || "리스크 메모 없음"}</small>
                  </article>
                ))}
              </div>
              <div className="result-columns report-results-columns">
                <div className="result-panel">
                  <h3>수집 데이터와 최종 판단</h3>
                  <div className="result-stack">
                    <section>
                      <span>수집 데이터</span>
                      {result.market_data.map((item) => (
                        <article className="output-card" key={item.symbol}>
                          <strong>{item.symbol}</strong>
                          <p>가격 {item.latest_price}</p>
                          <small>{item.news_headlines.join(" / ") || "뉴스 없음"}</small>
                          <small>{formatMetrics(item.financial_metrics)}</small>
                        </article>
                      ))}
                    </section>
                    <section>
                      <span>최종 판단</span>
                      {result.decisions.map((decision) => (
                        <article className="output-card" key={decision.symbol}>
                          <strong>{decision.symbol}</strong>
                          <p>
                            {actionLabel(decision.action)} · 신뢰도 {formatScore(decision.confidence)}
                          </p>
                          <small>{decision.rationale}</small>
                        </article>
                      ))}
                    </section>
                  </div>
                </div>
                <div className="result-panel save-panel">
                  <h3>보고서 저장</h3>
                  <p className="panel-helper">현재 실행을 보고서 메뉴에서 다시 보려면 이름을 적고 저장합니다.</p>
                  <label className="field">
                    <span>보고서 이름</span>
                    <input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>설명</span>
                    <textarea value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} />
                  </label>
                  <button disabled={!canSave} onClick={() => void handleSaveExperiment()} type="button">
                    {isSaving ? "저장 중..." : "최근 런 저장"}
                  </button>
                  {saveMessage ? <p className="inline-note">{saveMessage}</p> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>아직 실행된 런이 없습니다</h3>
              <p>채팅 또는 실행 조건을 정한 뒤 워크플로우를 실행하면 주문 전 보고서가 이곳에 표시됩니다.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
