import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  AgentInteractionResponse,
  DecisionRequest,
  DecisionResponse,
  FrontendWorkspaceSettings,
  RiskTolerance,
  actionLabel,
  fetchJson,
  formatDateTime,
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
  result: DecisionResponse;
};

type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
};

const RESULT_STORAGE_KEY = "latest-workflow-result";
const CHAT_STORAGE_KEY = "workflow-chat-history";

function loadStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function saveStoredJson<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function nowIso() { return new Date().toISOString(); }
function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDecisionRequest(
  symbols: string[],
  maxPositionWeight: number,
  userPrompt: string,
  riskTolerance: RiskTolerance,
  autoTradingEnabled: boolean,
  chatMessages: string[],
): DecisionRequest {
  return {
    symbols,
    max_position_weight: maxPositionWeight,
    user_prompt: userPrompt.trim(),
    chat_messages: chatMessages,
    mandate: {
      objective: userPrompt.trim() || "채팅 지시를 기반으로 요청 종목을 점검한다.",
      allowed_symbols: [],
      excluded_symbols: [],
      max_order_notional: null,
      min_cash_weight: null,
      risk_tolerance: riskTolerance,
      requires_approval_for_live_orders: !autoTradingEnabled,
      user_notes: "",
    },
  };
}

function buildAssistantSummary(result: DecisionResponse) {
  const summary = result.supervisor_directive.summary || "요약 없음";
  const decisions = result.decisions
    .map((d) => `${d.symbol} ${actionLabel(d.action)}`)
    .join(", ");
  return `실행 완료. 요약: "${summary}"${decisions ? ` / 판단: ${decisions}` : ""}`;
}

function riskLabel(v: RiskTolerance) {
  return v === "low" ? "낮음" : v === "high" ? "높음" : "보통";
}

export function WorkflowHome() {
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT");
  const [maxPositionWeight, setMaxPositionWeight] = useState("0.2");
  const [userPrompt, setUserPrompt] = useState("메인 에이전트가 채팅 지시를 반영해 보수적으로 종목을 검토한다.");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [applyChatToWorkflow, setApplyChatToWorkflow] = useState(true);
  const [chatDraft, setChatDraft] = useState("");
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextSettings = loadFrontendWorkspaceSettings();
    setSettings(nextSettings);
    setSymbolsInput(nextSettings.default_symbols);
    setMaxPositionWeight(nextSettings.default_max_position_weight);
    setRiskTolerance(nextSettings.default_risk_tolerance);
    setAutoTradingEnabled(nextSettings.auto_trading_enabled);
    setApplyChatToWorkflow(nextSettings.auto_apply_chat_followups);

    const storedResult = normalizeDecisionResponse(loadStoredJson<DecisionResponse>(RESULT_STORAGE_KEY));
    if (storedResult) setResult(storedResult);

    const storedChat = loadStoredJson<ChatEntry[]>(CHAT_STORAGE_KEY);
    if (storedChat) setChatEntries(storedChat);
  }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [chatEntries]);

  const symbols = useMemo(() => parseSymbols(symbolsInput), [symbolsInput]);
  const weight = Number(maxPositionWeight);
  const hasValidWeight = Number.isFinite(weight) && weight > 0 && weight <= 1;
  const canRun = symbols.length > 0 && hasValidWeight && !isLoading;
  const canSendFollowup = Boolean(result?.run_id) && chatDraft.trim().length > 0 && !isChatLoading;
  const hasRun = result !== null;

  function persistSettings(next: FrontendWorkspaceSettings) {
    setSettings(next);
    saveFrontendWorkspaceSettings(next);
  }

  function persistResult(next: DecisionResponse) {
    const normalized = normalizeDecisionResponse(next);
    if (!normalized) return;
    setResult(normalized);
    saveStoredJson(RESULT_STORAGE_KEY, normalized);
  }

  function persistChat(next: ChatEntry[]) {
    setChatEntries(next);
    saveStoredJson(CHAT_STORAGE_KEY, next);
  }

  function appendChat(entry: Omit<ChatEntry, "id" | "timestamp">) {
    persistChat([
      ...chatEntries,
      { id: buildId("chat"), timestamp: nowIso(), ...entry },
    ]);
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) return;
    setIsLoading(true);
    setError(null);
    setSaveMessage(null);

    const nextSettings = settings
      ? { ...settings, default_symbols: symbolsInput, default_max_position_weight: maxPositionWeight, default_risk_tolerance: riskTolerance, auto_trading_enabled: autoTradingEnabled }
      : null;
    if (nextSettings) persistSettings(nextSettings);

    appendChat({ role: "user", content: `실행 요청: ${symbols.join(", ")} / ${userPrompt}` });

    try {
      const requestBody = buildDecisionRequest(
        symbols,
        weight,
        userPrompt,
        riskTolerance,
        autoTradingEnabled,
        chatEntries.filter((e) => e.role === "user").map((e) => e.content),
      );
      const response = await fetchJson<DecisionResponse>("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const normalized = normalizeDecisionResponse(response);
      if (!normalized) throw new Error("실행 결과를 해석하지 못했습니다.");
      persistResult(normalized);
      appendChat({ role: "assistant", content: buildAssistantSummary(normalized) });
      setSaveName(`${symbols.join(", ")} 실행 보고서`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "실행에 실패했습니다.");
      appendChat({ role: "system", content: `오류: ${err instanceof Error ? err.message : "실행 실패"}` });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result?.run_id || !chatDraft.trim()) return;

    const userMessage = chatDraft.trim();
    setIsChatLoading(true);
    setError(null);
    setSaveMessage(null);
    appendChat({ role: "user", content: userMessage });
    setChatDraft("");

    try {
      const response = await fetchJson<AgentInteractionResponse>("/api/console/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: result.run_id,
          message: userMessage,
          apply_to_workflow: applyChatToWorkflow,
          current_result: result,
        }),
      });
      appendChat({ role: "assistant", content: response.reply });
      const updatedResult = normalizeDecisionResponse(response.updated_result);
      if (response.applied_to_workflow && updatedResult) {
        persistResult(updatedResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "후속 대화 처리에 실패했습니다.");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || isSaving) return;
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await fetchJson<unknown>("/api/experiments/from-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: result.run_id,
          name: saveName.trim() || `${result.symbols.join(", ")} 실행 보고서`,
          description: saveDescription.trim(),
          result,
        } satisfies ExperimentSaveRequest),
      });
      setSaveMessage("보고서 저장소에 보관했습니다.");
      setShowSaveForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleNewRun() {
    setResult(null);
    persistChat([]);
    setSaveMessage(null);
    setError(null);
    setShowSaveForm(false);
  }

  return (
    <div className="chat-console">
      <div className="chat-main panel">
        <div className="chat-thread" ref={threadRef}>
          {chatEntries.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">🤖</div>
              <h3>메인 에이전트와 대화를 시작하세요</h3>
              <p>종목과 목표를 입력하고 실행하면 에이전트가 분석을 시작합니다.</p>
            </div>
          ) : (
            chatEntries.map((entry) => (
              <div key={entry.id} className={`chat-message chat-message-${entry.role}`}>
                {entry.role !== "system" ? (
                  <span className={`chat-avatar chat-avatar-${entry.role}`}>
                    {entry.role === "user" ? "나" : "AI"}
                  </span>
                ) : null}
                <div className="chat-bubble-wrap">
                  <div className="chat-bubble">{entry.content}</div>
                  <span className="chat-meta">{formatDateTime(entry.timestamp)}</span>
                </div>
              </div>
            ))
          )}
          {(isLoading || isChatLoading) ? (
            <div className="chat-message chat-message-assistant">
              <span className="chat-avatar chat-avatar-assistant">AI</span>
              <div className="chat-bubble-wrap">
                <div className="chat-bubble chat-bubble-loading">
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <div className="banner banner-error" style={{ margin: "0 16px" }}>{error}</div> : null}

        <div className="chat-composer">
          {!hasRun ? (
            <form onSubmit={handleRun} className="chat-composer-form">
              <div className="chat-composer-params">
                <label className="composer-field">
                  <span>심볼</span>
                  <input
                    value={symbolsInput}
                    onChange={(e) => setSymbolsInput(e.target.value)}
                    placeholder="AAPL, MSFT"
                  />
                </label>
                <label className="composer-field">
                  <span>최대 비중</span>
                  <input
                    value={maxPositionWeight}
                    onChange={(e) => setMaxPositionWeight(e.target.value)}
                    placeholder="0.2"
                  />
                </label>
                <label className="composer-field">
                  <span>리스크</span>
                  <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)}>
                    <option value="low">낮음</option>
                    <option value="medium">보통</option>
                    <option value="high">높음</option>
                  </select>
                </label>
              </div>
              <label className="composer-field">
                <span>실행 목표</span>
                <textarea
                  rows={2}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="메인 에이전트에게 전달할 투자 목표나 지시를 입력하세요"
                />
              </label>
              <div className="chat-composer-actions">
                <label className="composer-toggle">
                  <input
                    type="checkbox"
                    checked={autoTradingEnabled}
                    onChange={(e) => setAutoTradingEnabled(e.target.checked)}
                  />
                  자동매매 승인
                </label>
                <button className="primary-button" disabled={!canRun} type="submit">
                  {isLoading ? "실행 중…" : "실행"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFollowUp} className="chat-composer-form">
              <textarea
                className="chat-input"
                rows={3}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="후속 질문이나 추가 지시를 입력하세요…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSendFollowup) {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
              />
              <div className="chat-composer-actions">
                <label className="composer-toggle">
                  <input
                    type="checkbox"
                    checked={applyChatToWorkflow}
                    onChange={(e) => setApplyChatToWorkflow(e.target.checked)}
                  />
                  워크플로우 재실행 반영
                </label>
                <button type="button" className="secondary-button" onClick={handleNewRun}>
                  새 실행
                </button>
                <button className="primary-button" disabled={!canSendFollowup} type="submit">
                  {isChatLoading ? "처리 중…" : "전송"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <aside className="chat-rail">
        <div className="chat-rail-section">
          <span className="chat-rail-label">현재 실행</span>
          {result ? (
            <>
              <div className="chat-rail-value mono">{result.run_id}</div>
              <div className="chat-rail-sub">{runtimeLabel(result.runtime)}</div>
            </>
          ) : (
            <div className="chat-rail-empty">실행 없음</div>
          )}
        </div>

        {result ? (
          <>
            <div className="chat-rail-section">
              <span className="chat-rail-label">목표</span>
              <div className="chat-rail-value">{result.supervisor_directive.objective || result.user_prompt || "—"}</div>
            </div>

            <div className="chat-rail-section">
              <span className="chat-rail-label">요약</span>
              <div className="chat-rail-value">
                {result.supervisor_directive.summary || result.investment_reports[0]?.summary || "—"}
              </div>
            </div>

            <div className="chat-rail-section">
              <span className="chat-rail-label">종목</span>
              <div className="discover-chip-row">
                {result.symbols.map((s) => (
                  <span key={s} className="discover-chip">{s}</span>
                ))}
              </div>
            </div>

            <div className="chat-rail-section">
              <span className="chat-rail-label">판단</span>
              <div className="chat-rail-decisions">
                {result.decisions.length > 0 ? (
                  result.decisions.map((d) => (
                    <div key={d.symbol} className={`decision-row decision-row-${d.action.toLowerCase()}`}>
                      <span>{d.symbol}</span>
                      <strong>{actionLabel(d.action)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="chat-rail-empty">판단 없음</div>
                )}
              </div>
            </div>

            <div className="chat-rail-section">
              <span className="chat-rail-label">리스크</span>
              <div className="chat-rail-value">{riskLabel(result.mandate.risk_tolerance)}</div>
            </div>

            <div className="chat-rail-divider" />

            {saveMessage ? (
              <div className="banner banner-success" style={{ fontSize: "0.82rem" }}>{saveMessage}</div>
            ) : null}

            {showSaveForm ? (
              <form onSubmit={handleSave} className="chat-rail-save-form">
                <label className="composer-field">
                  <span>보고서 이름</span>
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                </label>
                <label className="composer-field">
                  <span>설명</span>
                  <textarea rows={2} value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setShowSaveForm(false)}>취소</button>
                  <button type="submit" className="primary-button" style={{ flex: 1 }} disabled={isSaving}>
                    {isSaving ? "저장 중…" : "저장"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%" }}
                onClick={() => setShowSaveForm(true)}
              >
                보고서로 저장
              </button>
            )}
          </>
        ) : (
          <div className="chat-rail-hint">
            <p>실행 후 결과 요약, 종목별 판단, 보고서 저장 기능이 여기에 표시됩니다.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
