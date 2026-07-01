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
  result: DecisionResponse;
};

type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
};

type RecentRunRecord = {
  run_id: string;
  viewed_at: string;
  result: DecisionResponse;
};

const RESULT_STORAGE_KEY = "latest-workflow-result";
const CHAT_STORAGE_KEY = "workflow-chat-history";
const RECENT_RUNS_STORAGE_KEY = "workflow-recent-runs";

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

function nowIso() {
  return new Date().toISOString();
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function riskToleranceLabel(value: RiskTolerance) {
  if (value === "low") return "낮음";
  if (value === "high") return "높음";
  return "보통";
}

function buildAssistantSummary(result: DecisionResponse) {
  const summary = result.supervisor_directive.summary || "요약 없음";
  const decisions = result.decisions.map((decision) => `${decision.symbol} ${actionLabel(decision.action)}`).join(", ");
  return `실행이 끝났습니다. 메인 요약은 "${summary}"이고 현재 판단은 ${decisions || "없음"}입니다.`;
}

function buildRunHeadline(result: DecisionResponse) {
  return result.supervisor_directive.objective || result.user_prompt || "최근 실행";
}

function buildRunSummary(result: DecisionResponse) {
  return result.supervisor_directive.summary || result.investment_reports[0]?.summary || "저장된 실행 요약이 없습니다.";
}

function normalizeRecentRuns(value: unknown): RecentRunRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const result = normalizeDecisionResponse(record.result);
      if (!result) {
        return null;
      }
      return {
        run_id: typeof record.run_id === "string" ? record.run_id : result.run_id,
        viewed_at: typeof record.viewed_at === "string" ? record.viewed_at : nowIso(),
        result,
      };
    })
    .filter((item): item is RecentRunRecord => item !== null);
}

function SectionHeader({ title, count }: { title: string; count?: string | number }) {
  return (
    <div className="discover-section-header">
      <div className="discover-section-title-row">
        <h2>{title}</h2>
        {count !== undefined ? <span className="section-count-badge">{count}</span> : null}
      </div>
      <div className="section-actions">
        <button type="button">Configure</button>
        <button type="button">See all</button>
      </div>
    </div>
  );
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
  const [applyChatToWorkflow, setApplyChatToWorkflow] = useState(true);
  const [chatDraft, setChatDraft] = useState("");
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [saveName, setSaveName] = useState("최근 실행 보고서");
  const [saveDescription, setSaveDescription] = useState("");
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRunRecord[]>([]);
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
    setApplyChatToWorkflow(nextSettings.auto_apply_chat_followups);

    const storedResult = normalizeDecisionResponse(loadStoredJson<DecisionResponse>(RESULT_STORAGE_KEY));
    if (storedResult) {
      setResult(storedResult);
    }

    const storedChat = loadStoredJson<ChatEntry[]>(CHAT_STORAGE_KEY);
    if (storedChat) {
      setChatEntries(storedChat);
    }

    const storedRuns = normalizeRecentRuns(loadStoredJson<RecentRunRecord[]>(RECENT_RUNS_STORAGE_KEY));
    setRecentRuns(storedRuns);
  }, []);

  const symbols = useMemo(() => parseSymbols(symbolsInput), [symbolsInput]);
  const allowedSymbols = useMemo(() => parseSymbols(allowedSymbolsInput), [allowedSymbolsInput]);
  const excludedSymbols = useMemo(() => parseSymbols(excludedSymbolsInput), [excludedSymbolsInput]);
  const weight = Number(maxPositionWeight);
  const hasValidWeight = Number.isFinite(weight) && weight > 0 && weight <= 1;
  const canRun = symbols.length > 0 && hasValidWeight && !isLoading;
  const canSave = Boolean(result && saveName.trim() && !isSaving);
  const activeRun = result ?? recentRuns[0]?.result ?? null;

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
    const nextRecentRuns = [
      { run_id: normalizedResult.run_id, viewed_at: nowIso(), result: normalizedResult },
      ...recentRuns.filter((item) => item.run_id !== normalizedResult.run_id),
    ].slice(0, 9);
    setRecentRuns(nextRecentRuns);
    saveStoredJson(RECENT_RUNS_STORAGE_KEY, nextRecentRuns);
  }

  function persistChat(nextChat: ChatEntry[]) {
    setChatEntries(nextChat);
    saveStoredJson(CHAT_STORAGE_KEY, nextChat);
  }

  function appendChat(entry: Omit<ChatEntry, "id" | "timestamp">) {
    const nextChat = [
      ...chatEntries,
      { id: buildId("chat"), timestamp: nowIso(), ...entry },
    ];
    persistChat(nextChat);
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) return;

    setIsLoading(true);
    setError(null);
    setSaveMessage(null);

    try {
      const nextSettings = settings
        ? {
            ...settings,
            default_symbols: symbolsInput,
            default_max_position_weight: maxPositionWeight,
            default_risk_tolerance: riskTolerance,
            auto_trading_enabled: autoTradingEnabled,
            auto_apply_chat_followups: applyChatToWorkflow,
          }
        : null;
      if (nextSettings) {
        persistSettings(nextSettings);
      }

      const requestBody = buildDecisionRequest(
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
      const response = await fetchJson<DecisionResponse>("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const normalizedResponse = normalizeDecisionResponse(response);
      if (!normalizedResponse) throw new Error("실행 결과를 해석하지 못했습니다.");
      persistResult(normalizedResponse);
      appendChat({ role: "assistant", content: buildAssistantSummary(normalizedResponse) });
      setSaveName(`${symbols.join(", ")} 실행 보고서`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "실행에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRun?.run_id || !chatDraft.trim()) return;

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
          run_id: activeRun.run_id,
          message: userMessage,
          apply_to_workflow: applyChatToWorkflow,
          current_result: activeRun,
        }),
      });
      appendChat({ role: "assistant", content: response.reply });
      const updatedResult = normalizeDecisionResponse(response.updated_result);
      if (response.applied_to_workflow && updatedResult) {
        persistResult(updatedResult);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "후속 대화 처리에 실패했습니다.");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleSaveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || !canSave) return;

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      await fetchJson<unknown>("/api/experiments/from-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: result.run_id,
          name: saveName.trim(),
          description: saveDescription.trim(),
          result,
        } satisfies ExperimentSaveRequest),
      });
      setSaveMessage("현재 실행을 보고서 저장소에 보관했습니다.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "보고서 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const favoriteAgentCards = agentDefinitions.map((agent) => {
    if (!activeRun) {
      return { key: agent.key, label: agent.label, meta: "최근 실행 없음", body: "최근 런을 실행하면 이 단계 결과가 요약됩니다." };
    }
    if (agent.key === "data_collection") {
      return {
        key: agent.key,
        label: agent.label,
        meta: `${activeRun.market_data.length}개 수집`,
        body: activeRun.market_data[0]
          ? `${activeRun.market_data[0].symbol} ${activeRun.market_data[0].latest_price} · ${formatMetrics(activeRun.market_data[0].financial_metrics)}`
          : "수집 데이터 없음",
      };
    }
    if (agent.key === "data_analysis") {
      return {
        key: agent.key,
        label: agent.label,
        meta: `${activeRun.analysis_signals.length}개 시그널`,
        body: activeRun.analysis_signals[0]
          ? `${activeRun.analysis_signals[0].symbol} 총점 ${formatScore(activeRun.analysis_signals[0].total_score)} · ${activeRun.analysis_signals[0].rationale}`
          : "분석 결과 없음",
      };
    }
    if (agent.key === "report") {
      return { key: agent.key, label: agent.label, meta: `${activeRun.investment_reports.length}개 보고서`, body: activeRun.investment_reports[0]?.summary || "보고서 결과 없음" };
    }
    if (agent.key === "buy_sell") {
      return { key: agent.key, label: agent.label, meta: `${activeRun.decisions.length}개 판단`, body: activeRun.decisions[0] ? `${activeRun.decisions[0].symbol} ${actionLabel(activeRun.decisions[0].action)} · ${formatScore(activeRun.decisions[0].confidence)}` : "판단 결과 없음" };
    }
    if (agent.key === "order_execution") {
      return { key: agent.key, label: agent.label, meta: `${activeRun.orders.length}개 주문 계획`, body: activeRun.orders[0] ? `${activeRun.orders[0].symbol} ${activeRun.orders[0].should_submit ? "제출 가능" : "차단"} · ${activeRun.orders[0].reason}` : "주문 계획 없음" };
    }
    return { key: agent.key, label: agent.label, meta: `${activeRun.evaluation_log.decision_count}개 판단`, body: activeRun.evaluation_log.notes.join(" / ") || "후속 메모 없음" };
  });

  const workflowGroups = [
    {
      title: "데이터 수집 -> 데이터 분석 -> 보고서 작성",
      meta: activeRun ? `${activeRun.market_data.length} / ${activeRun.analysis_signals.length} / ${activeRun.investment_reports.length}` : "아직 실행 없음",
      nodes: ["Text", "Model", "Report"],
    },
    {
      title: "보고서 작성 -> 매수/매도 판단 -> 주문 실행",
      meta: activeRun ? `${activeRun.decisions.length}개 판단 / ${activeRun.orders.length}개 주문` : "아직 실행 없음",
      nodes: ["Risk", "Decision", "Order"],
    },
    {
      title: "메인 에이전트 -> 정책 가드레일 -> 주문 계획",
      meta: activeRun ? `${activeRun.mandate_violations.length}개 위반 / ${activeRun.evaluation_log.blocked_order_count}개 차단` : "아직 실행 없음",
      nodes: ["Main", "Guard", "Plan"],
    },
  ];

  return (
    <main className="discover-page" id="new-run">
      {error ? <div className="banner banner-error">{error}</div> : null}
      {saveMessage ? <div className="banner banner-success">{saveMessage}</div> : null}

      <section className="discover-toolbar-panel">
        <div>
          <span className="discover-eyebrow">Console / Discover</span>
          <h1>메인 워크플로우 홈</h1>
          <p>최근 실행, 에이전트별 요약, 저장 전 검토 흐름을 탐색형 레이아웃으로 정리했다.</p>
        </div>
        <div className="discover-summary-strip">
          <div>
            <span>Active run</span>
            <strong>{activeRun?.run_id || "없음"}</strong>
          </div>
          <div>
            <span>Runtime</span>
            <strong>{activeRun?.runtime ? runtimeLabel(activeRun.runtime) : "정보 없음"}</strong>
          </div>
          <div>
            <span>Risk</span>
            <strong>{riskToleranceLabel(riskTolerance)}</strong>
          </div>
        </div>
      </section>

      <section className="discover-section">
        <SectionHeader title="Recently viewed workflow runs" count={recentRuns.length} />
        {recentRuns.length ? (
          <div className="discover-card-grid">
            {recentRuns.map((item) => (
              <button className="discover-card" key={item.run_id} onClick={() => setResult(item.result)} type="button">
                <div className="discover-card-top">
                  <div>
                    <strong>{buildRunHeadline(item.result)}</strong>
                    <small>{runtimeLabel(item.result.runtime)}</small>
                  </div>
                </div>
                <span className="discover-card-subtitle">{item.result.run_id}</span>
                <p>{buildRunSummary(item.result)}</p>
                <div className="discover-chip-row">
                  {item.result.symbols.slice(0, 3).map((symbol) => (
                    <span className="discover-chip" key={symbol}>{symbol}</span>
                  ))}
                  <span className="discover-chip">{riskToleranceLabel(item.result.mandate.risk_tolerance)}</span>
                </div>
                <small>{formatDateTime(item.viewed_at)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-panel"><h3>최근 실행 기록이 없습니다</h3><p>새 실행을 시작하면 이 섹션에 카드가 생성됩니다.</p></div>
        )}
      </section>

      <section className="discover-section">
        <SectionHeader title="Favorite agent views" count={favoriteAgentCards.length} />
        <div className="discover-card-grid">
          {favoriteAgentCards.map((item) => (
            <article className="discover-card" key={item.key}>
              <div className="discover-card-top">
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.meta}</small>
                </div>
                <span className="favorite-star">★</span>
              </div>
              <span className="discover-card-subtitle">단계 요약</span>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="discover-section">
        <SectionHeader title="Favourite workflow groups" count={workflowGroups.length} />
        <div className="discover-card-grid discover-card-grid-flow">
          {workflowGroups.map((group) => (
            <article className="discover-card discover-card-flow" key={group.title}>
              <div className="discover-card-top">
                <div>
                  <strong>{group.title}</strong>
                  <small>{group.meta}</small>
                </div>
              </div>
              <div className="mini-flow-canvas">
                {group.nodes.map((node, index) => (
                  <div className="mini-flow-node-wrap" key={node}>
                    <span className="mini-flow-node">{node}</span>
                    {index < group.nodes.length - 1 ? <span className="mini-flow-line" /> : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="discover-control-grid">
        <article className="discover-panel discover-panel-wide">
          <h3>New workflow run</h3>
          <form className="discover-form" onSubmit={handleRun}>
            <div className="discover-form-grid discover-form-grid-3">
              <label><span>심볼</span><input value={symbolsInput} onChange={(event) => setSymbolsInput(event.target.value)} /></label>
              <label><span>최대 비중</span><input value={maxPositionWeight} onChange={(event) => setMaxPositionWeight(event.target.value)} /></label>
              <label><span>리스크</span><select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as RiskTolerance)}><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option></select></label>
            </div>
            <label><span>메인 목표</span><textarea rows={4} value={userPrompt} onChange={(event) => setUserPrompt(event.target.value)} /></label>
            <div className="discover-form-grid discover-form-grid-2">
              <label><span>허용 심볼</span><input value={allowedSymbolsInput} onChange={(event) => setAllowedSymbolsInput(event.target.value)} /></label>
              <label><span>제외 심볼</span><input value={excludedSymbolsInput} onChange={(event) => setExcludedSymbolsInput(event.target.value)} /></label>
            </div>
            <label><span>추가 메모</span><textarea rows={3} value={userNotes} onChange={(event) => setUserNotes(event.target.value)} /></label>
            <div className="discover-toggle-row">
              <label><input checked={autoTradingEnabled} onChange={(event) => setAutoTradingEnabled(event.target.checked)} type="checkbox" />자동매매 승인 기본값</label>
              <label><input checked={applyChatToWorkflow} onChange={(event) => setApplyChatToWorkflow(event.target.checked)} type="checkbox" />후속 대화 재실행 반영</label>
            </div>
            <button className="discover-primary-button" disabled={!canRun} type="submit">{isLoading ? "실행 중..." : "실행"}</button>
          </form>
        </article>

        <article className="discover-panel">
          <h3>Follow-up assistant</h3>
          <form className="discover-form" onSubmit={handleFollowUp}>
            <label><span>후속 질문</span><textarea rows={5} value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} /></label>
            <button className="discover-secondary-button" disabled={!activeRun?.run_id || !chatDraft.trim() || isChatLoading} type="submit">{isChatLoading ? "전송 중..." : "질문 보내기"}</button>
          </form>
          <div className="discover-chat-list">
            {chatEntries.slice(-4).map((entry) => (
              <article className="discover-chat-item" key={entry.id}>
                <div><strong>{entry.role === "user" ? "사용자" : entry.role === "assistant" ? "어시스턴트" : "시스템"}</strong><small>{formatDateTime(entry.timestamp)}</small></div>
                <p>{entry.content}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="discover-panel">
          <h3>Save report</h3>
          <form className="discover-form" onSubmit={handleSaveReport}>
            <label><span>보고서 이름</span><input value={saveName} onChange={(event) => setSaveName(event.target.value)} /></label>
            <label><span>설명</span><textarea rows={5} value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} /></label>
            <button className="discover-secondary-button" disabled={!canSave} type="submit">{isSaving ? "저장 중..." : "저장"}</button>
          </form>
        </article>
      </section>

      <section className="discover-detail-grid">
        <article className="discover-panel">
          <h3>Active summary</h3>
          {activeRun ? (
            <div className="active-summary-list">
              <div><span>메인 요약</span><strong>{buildRunSummary(activeRun)}</strong></div>
              <div><span>판단</span><strong>{activeRun.decisions.map((item) => `${item.symbol} ${actionLabel(item.action)}`).join(" / ") || "없음"}</strong></div>
              <div><span>주문 계획</span><strong>{activeRun.orders.map((item) => `${item.symbol} ${item.should_submit ? "submit" : "blocked"}`).join(" / ") || "없음"}</strong></div>
              <div><span>평가 메모</span><strong>{activeRun.evaluation_log.notes.join(" / ") || "없음"}</strong></div>
            </div>
          ) : (
            <div className="empty-panel"><h3>선택된 실행 없음</h3><p>실행 후 요약이 여기에 표시됩니다.</p></div>
          )}
        </article>
        <article className="discover-panel">
          <h3>Decision resources</h3>
          {activeRun ? (
            <div className="resource-mini-grid">
              <div><span>데이터 수집</span><strong>{activeRun.market_data.length}</strong></div>
              <div><span>데이터 분석</span><strong>{activeRun.analysis_signals.length}</strong></div>
              <div><span>보고서 작성</span><strong>{activeRun.investment_reports.length}</strong></div>
              <div><span>주문 실행</span><strong>{activeRun.orders.length}</strong></div>
            </div>
          ) : (
            <div className="empty-panel"><h3>런 결과 없음</h3><p>실행 후 리소스 카운트가 표시됩니다.</p></div>
          )}
        </article>
      </section>
    </main>
  );
}
