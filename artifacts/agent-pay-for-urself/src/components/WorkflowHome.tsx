import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  AgentInteractionResponse,
  DecisionResponse,
  FrontendWorkspaceSettings,
  RiskTolerance,
  actionLabel,
  fetchJson,
  formatDateTime,
  loadFrontendWorkspaceSettings,
  normalizeDecisionResponse,
  parseSymbols,
  runtimeAgentStatuses,
  runtimeLabel,
  saveFrontendWorkspaceSettings,
} from "../lib/workspace";

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
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveStoredJson<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function nowIso() {
  return new Date().toISOString();
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function riskLabel(v: RiskTolerance) {
  return v === "low" ? "낮음" : v === "high" ? "높음" : "보통";
}

function buildWelcomeText(symbolsInput: string) {
  const symbols = parseSymbols(symbolsInput);
  if (symbols.length > 0) {
    return `메인 에이전트와 대화를 시작하세요. 현재 컨텍스트는 ${symbols.join(", ")} 입니다.`;
  }
  return "메인 에이전트와 대화를 시작하세요. 종목을 넣으면 바로 분석 흐름으로 이어갈 수 있습니다.";
}

export function WorkflowHome() {
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT");
  const [maxPositionWeight, setMaxPositionWeight] = useState("0.2");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [applyChatToWorkflow, setApplyChatToWorkflow] = useState(true);
  const [chatDraft, setChatDraft] = useState("");
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const canSend = chatDraft.trim().length > 0 && !isSending;
  const runtimeStatuses = useMemo(() => runtimeAgentStatuses(result?.runtime ?? null), [result]);

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

  function persistChat(next: ChatEntry[] | ((prev: ChatEntry[]) => ChatEntry[])) {
    setChatEntries((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveStoredJson(CHAT_STORAGE_KEY, resolved);
      return resolved;
    });
  }

  function appendChat(entry: Omit<ChatEntry, "id" | "timestamp">) {
    persistChat((prev) => [
      ...prev,
      { id: buildId("chat"), timestamp: nowIso(), ...entry },
    ]);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message) return;

    setIsSending(true);
    setError(null);

    const nextSettings = settings
      ? {
          ...settings,
          default_symbols: symbolsInput,
          default_max_position_weight: maxPositionWeight,
          default_risk_tolerance: riskTolerance,
          auto_trading_enabled: autoTradingEnabled,
        }
      : null;
    if (nextSettings) persistSettings(nextSettings);

    appendChat({ role: "user", content: message });
    setChatDraft("");

    try {
      const response = await fetchJson<AgentInteractionResponse>("/api/console/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: result?.run_id ?? null,
          message,
          apply_to_workflow: applyChatToWorkflow,
          current_result: result,
          symbols,
          max_position_weight: hasValidWeight ? weight : 0.2,
          risk_tolerance: riskTolerance,
          auto_trading_enabled: autoTradingEnabled,
        }),
      });

      appendChat({ role: "assistant", content: response.reply });

      const updatedResult = normalizeDecisionResponse(response.updated_result);
      if (response.applied_to_workflow && updatedResult) {
        persistResult(updatedResult);
      }
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "메시지를 처리하지 못했습니다.";
      setError(messageText);
      appendChat({ role: "system", content: `오류: ${messageText}` });
    } finally {
      setIsSending(false);
    }
  }

  function handleNewConversation() {
    setResult(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RESULT_STORAGE_KEY);
    }
    persistChat([]);
    setError(null);
  }

  return (
    <div className="chat-console">
      <div className="chat-main panel">
        <div className="chat-thread" ref={threadRef}>
          {chatEntries.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">AI</div>
              <h3>메인 에이전트와 대화를 시작하세요</h3>
              <p>{buildWelcomeText(symbolsInput)}</p>
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
          {isSending ? (
            <div className="chat-message chat-message-assistant">
              <span className="chat-avatar chat-avatar-assistant">AI</span>
              <div className="chat-bubble-wrap">
                <div className="chat-bubble chat-bubble-loading">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <div className="banner banner-error" style={{ margin: "0 16px" }}>{error}</div> : null}

        <form onSubmit={handleSend} className="chat-composer">
          <textarea
            className="chat-input"
            rows={3}
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="메인 에이전트에게 질문하거나, 종목과 함께 분석을 요청하세요…"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
          />
          <div className="chat-composer-actions">
            <button type="button" className="secondary-button" onClick={handleNewConversation}>
              새 대화
            </button>
            <label className="composer-toggle">
              <input
                type="checkbox"
                checked={applyChatToWorkflow}
                onChange={(event) => setApplyChatToWorkflow(event.target.checked)}
              />
              워크플로우 재실행 반영
            </label>
            <button className="primary-button" disabled={!canSend} type="submit">
              {isSending ? "응답 중…" : "보내기"}
            </button>
          </div>
        </form>
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
            <div className="chat-rail-empty">대화 모드</div>
          )}
        </div>

        <div className="chat-rail-section">
          <span className="chat-rail-label">대화 컨텍스트</span>
          <div className="chat-rail-context">
            <label className="composer-field">
              <span>심볼</span>
              <input
                value={symbolsInput}
                onChange={(event) => setSymbolsInput(event.target.value)}
                placeholder="AAPL, MSFT"
              />
            </label>
            <label className="composer-field">
              <span>최대 비중</span>
              <input
                value={maxPositionWeight}
                onChange={(event) => setMaxPositionWeight(event.target.value)}
                placeholder="0.2"
              />
            </label>
            <label className="composer-field">
              <span>리스크</span>
              <select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as RiskTolerance)}>
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
            </label>
          </div>
          <div className="toggle-row" style={{ marginTop: 12 }}>
            <label className="toggle-chip">
              <input
                checked={autoTradingEnabled}
                onChange={(event) => setAutoTradingEnabled(event.target.checked)}
                type="checkbox"
              />
              자동매매 승인
            </label>
          </div>
          <div className="toggle-row" style={{ marginTop: 8 }}>
            <label className="toggle-chip">
              <input
                checked={applyChatToWorkflow}
                onChange={(event) => setApplyChatToWorkflow(event.target.checked)}
                type="checkbox"
              />
              대화와 워크플로우 연결
            </label>
          </div>
          <p className="chat-rail-sub" style={{ marginTop: 12 }}>
            심볼이 있으면 바로 분석 실행으로 연결되고, 심볼이 없으면 대화형 답변만 받습니다.
          </p>
        </div>

        <div className="chat-rail-section">
          <span className="chat-rail-label">에이전트 연결</span>
          <div className="chat-rail-agent-statuses">
            {runtimeStatuses.map((status) => (
              <div key={status.key} className="chat-rail-agent-status">
                <span>{status.label}</span>
                <strong className={status.connected ? "text-success" : "text-muted"}>{status.status}</strong>
              </div>
            ))}
          </div>
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
                {result.symbols.map((symbol) => (
                  <span key={symbol} className="discover-chip">{symbol}</span>
                ))}
              </div>
            </div>

            <div className="chat-rail-section">
              <span className="chat-rail-label">판단</span>
              <div className="chat-rail-decisions">
                {result.decisions.length > 0 ? (
                  result.decisions.map((decision) => (
                    <div key={decision.symbol} className={`decision-row decision-row-${decision.action.toLowerCase()}`}>
                      <span>{decision.symbol}</span>
                      <strong>{actionLabel(decision.action)}</strong>
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
            <p className="chat-rail-sub" style={{ fontSize: "0.82rem" }}>
              보고서는 실행 즉시 에이전트가 자동 저장합니다.
            </p>
          </>
        ) : (
          <div className="chat-rail-hint">
            <p>대화가 누적되면 여기서 현재 실행, 에이전트 연결, 요약, 판단을 함께 확인할 수 있습니다.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
