import { FormEvent, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
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
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function saveStoredJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function nowIso() { return new Date().toISOString(); }
function buildId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function riskToleranceLabel(value: RiskTolerance) {
  if (value === "low") return "낮음";
  if (value === "high") return "높음";
  return "보통";
}

function buildAssistantSummary(result: DecisionResponse) {
  const summary = result.supervisor_directive.summary || "요약 없음";
  const decisions = result.decisions.map((d) => `${d.symbol} ${actionLabel(d.action)}`).join(", ");
  return `실행이 끝났습니다. 메인 요약은 "${summary}"이고 현재 판단은 ${decisions || "없음"}입니다.`;
}

function buildRunHeadline(result: DecisionResponse) {
  return result.supervisor_directive.objective || result.user_prompt || "최근 실행";
}

function normalizeRecentRuns(value: unknown): RecentRunRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const result = normalizeDecisionResponse(record.result);
      if (!result) return null;
      return {
        run_id: typeof record.run_id === "string" ? record.run_id : result.run_id,
        viewed_at: typeof record.viewed_at === "string" ? record.viewed_at : nowIso(),
        result,
      };
    })
    .filter((item): item is RecentRunRecord => item !== null);
}

export function WorkflowHome() {
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT");
  const [maxPositionWeight, setMaxPositionWeight] = useState("0.2");
  const [userPrompt, setUserPrompt] = useState("메인 에이전트가 채팅 지시를 반영해 보수적으로 종목을 검토한다.");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
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

  useEffect(() => {
    const nextSettings = loadFrontendWorkspaceSettings();
    setSettings(nextSettings);
    setSymbolsInput(nextSettings.default_symbols);
    setMaxPositionWeight(nextSettings.default_max_position_weight);
    setRiskTolerance(nextSettings.default_risk_tolerance);
    setApplyChatToWorkflow(nextSettings.auto_apply_chat_followups);

    const storedResult = normalizeDecisionResponse(loadStoredJson<DecisionResponse>(RESULT_STORAGE_KEY));
    if (storedResult) setResult(storedResult);

    const storedChat = loadStoredJson<ChatEntry[]>(CHAT_STORAGE_KEY);
    if (storedChat) setChatEntries(storedChat);

    const storedRuns = normalizeRecentRuns(loadStoredJson<RecentRunRecord[]>(RECENT_RUNS_STORAGE_KEY));
    setRecentRuns(storedRuns);
  }, []);

  const symbols = useMemo(() => parseSymbols(symbolsInput), [symbolsInput]);
  const weight = Number(maxPositionWeight);
  const hasValidWeight = Number.isFinite(weight) && weight > 0 && weight <= 1;
  const canRun = symbols.length > 0 && hasValidWeight && !isLoading;
  const activeRun = result ?? recentRuns[0]?.result ?? null;

  function persistResult(nextResult: DecisionResponse) {
    const normalizedResult = normalizeDecisionResponse(nextResult);
    if (!normalizedResult) return;
    setResult(normalizedResult);
    saveStoredJson(RESULT_STORAGE_KEY, normalizedResult);
    const nextRecentRuns = [
      { run_id: normalizedResult.run_id, viewed_at: nowIso(), result: normalizedResult },
      ...recentRuns.filter((item) => item.run_id !== normalizedResult.run_id),
    ].slice(0, 9);
    setRecentRuns(nextRecentRuns);
    saveStoredJson(RECENT_RUNS_STORAGE_KEY, nextRecentRuns);
  }

  function appendChat(entry: Omit<ChatEntry, "id" | "timestamp">) {
    const nextChat = [...chatEntries, { id: buildId("chat"), timestamp: nowIso(), ...entry }];
    setChatEntries(nextChat);
    saveStoredJson(CHAT_STORAGE_KEY, nextChat);
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) return;
    setIsLoading(true);
    try {
      const requestBody = buildDecisionRequest(symbols, weight, userPrompt, [], [], riskTolerance, false, "", chatEntries.filter((e) => e.role === "user").map((e) => e.content));
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
    } catch (e) {
      alert("실행 실패");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRun?.run_id || !chatDraft.trim()) return;
    const userMessage = chatDraft.trim();
    setIsChatLoading(true);
    appendChat({ role: "user", content: userMessage });
    setChatDraft("");
    try {
      const response = await fetchJson<AgentInteractionResponse>("/api/console/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: activeRun.run_id, message: userMessage, apply_to_workflow: applyChatToWorkflow, current_result: activeRun }),
      });
      appendChat({ role: "assistant", content: response.reply });
      const updatedResult = normalizeDecisionResponse(response.updated_result);
      if (response.applied_to_workflow && updatedResult) {
        persistResult(updatedResult);
      }
    } catch (e) {
      alert("대화 실패");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleSaveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;
    setIsSaving(true);
    try {
      await fetchJson<unknown>("/api/experiments/from-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: result.run_id, name: saveName.trim(), description: saveDescription.trim(), result } satisfies ExperimentSaveRequest),
      });
      alert("보고서가 저장되었습니다.");
    } catch (e) {
      alert("보고서 저장 실패");
    } finally {
      setIsSaving(false);
    }
  }

  const favoriteAgentCards = agentDefinitions.map((agent) => {
    if (!activeRun) return { key: agent.key, label: agent.label, meta: "최근 실행 없음", body: "최근 런을 실행하면 이 단계 결과가 요약됩니다." };
    if (agent.key === "data_collection") return { key: agent.key, label: agent.label, meta: `${activeRun.market_data.length}개 수집`, body: activeRun.market_data[0] ? `${activeRun.market_data[0].symbol} ${activeRun.market_data[0].latest_price}` : "수집 데이터 없음" };
    if (agent.key === "data_analysis") return { key: agent.key, label: agent.label, meta: `${activeRun.analysis_signals.length}개 시그널`, body: activeRun.analysis_signals[0] ? `${activeRun.analysis_signals[0].symbol} 총점 ${formatScore(activeRun.analysis_signals[0].total_score)}` : "분석 결과 없음" };
    if (agent.key === "report") return { key: agent.key, label: agent.label, meta: `${activeRun.investment_reports.length}개 보고서`, body: activeRun.investment_reports[0]?.summary || "보고서 결과 없음" };
    if (agent.key === "buy_sell") return { key: agent.key, label: agent.label, meta: `${activeRun.decisions.length}개 판단`, body: activeRun.decisions[0] ? `${activeRun.decisions[0].symbol} ${actionLabel(activeRun.decisions[0].action)}` : "판단 결과 없음" };
    if (agent.key === "order_execution") return { key: agent.key, label: agent.label, meta: `${activeRun.orders.length}개 주문`, body: activeRun.orders[0] ? `${activeRun.orders[0].symbol} ${activeRun.orders[0].should_submit ? "제출 가능" : "차단"}` : "주문 계획 없음" };
    return { key: agent.key, label: agent.label, meta: `${activeRun.evaluation_log.decision_count}개 판단`, body: activeRun.evaluation_log.notes.join(" / ") || "후속 메모 없음" };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">Workflow Console</h1>
      </div>

      <div className="grid-2 mb-8">
        <div className="card">
          <h2 className="card-title">New workflow run</h2>
          <form onSubmit={handleRun}>
            <div className="grid-3 mb-6">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">심볼</label>
                <input className="input-field" value={symbolsInput} onChange={(e) => setSymbolsInput(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">최대 비중</label>
                <input className="input-field" value={maxPositionWeight} onChange={(e) => setMaxPositionWeight(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">리스크</label>
                <select className="input-field" value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)}>
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메인 목표</label>
              <textarea className="input-field" rows={3} value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!canRun} type="submit">{isLoading ? "실행 중..." : "실행"}</button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">Follow-up assistant</h2>
          <div style={{ height: 160, overflowY: 'auto', marginBottom: 16 }}>
            {chatEntries.map((entry) => (
              <div key={entry.id} className={`chat-bubble ${entry.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>{entry.role === 'user' ? 'User' : 'Assistant'}</div>
                <div>{entry.content}</div>
              </div>
            ))}
            {chatEntries.length === 0 && <div className="empty-state" style={{ padding: 24 }}><p>대화 기록이 없습니다.</p></div>}
          </div>
          <form onSubmit={handleFollowUp} className="flex-row gap-4">
            <input className="input-field" placeholder="후속 질문..." value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} />
            <button className="btn btn-secondary" disabled={!activeRun || !chatDraft.trim() || isChatLoading} type="submit">전송</button>
          </form>
          <div className="mt-4 flex-row gap-2">
             <input type="checkbox" id="applyChat" checked={applyChatToWorkflow} onChange={e => setApplyChatToWorkflow(e.target.checked)} />
             <label htmlFor="applyChat" className="form-label" style={{ marginBottom: 0 }}>워크플로우에 반영</label>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="section-title">Recently viewed workflow runs</h2>
        {recentRuns.length > 0 ? (
          <div className="grid-3">
            {recentRuns.slice(0,3).map((item) => (
              <div className="card interactive" key={item.run_id} onClick={() => setResult(item.result)}>
                <div className="flex-row justify-between mb-6">
                   <h3 className="card-title" style={{ marginBottom: 0 }}>{buildRunHeadline(item.result)}</h3>
                   <span className="badge badge-info">{item.result.runtime?.data_mode || "live"}</span>
                </div>
                <p className="card-subtitle">{item.run_id.slice(0,8)}... • {formatDateTime(item.viewed_at)}</p>
                <div className="flex-row gap-2">
                  {item.result.symbols.slice(0,3).map(s => <span key={s} className="badge badge-hold">{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>최근 실행 기록이 없습니다.</p>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="section-title">Favorite agent views</h2>
        <div className="grid-3">
          {favoriteAgentCards.map((item) => (
             <div className="card" key={item.key}>
                <div className="flex-row justify-between mb-6">
                  <h3 className="card-title" style={{ marginBottom: 0 }}>{item.label}</h3>
                  <Star size={16} color="#f59e0b" fill="#fef3c7" />
                </div>
                <p className="card-subtitle">{item.meta}</p>
                <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.body}</p>
             </div>
          ))}
        </div>
      </div>

      {activeRun && (
        <div className="card">
          <h2 className="card-title">Save report</h2>
          <form onSubmit={handleSaveReport} className="grid-3">
             <div className="form-group" style={{ marginBottom: 0 }}>
               <label className="form-label">보고서 이름</label>
               <input className="input-field" value={saveName} onChange={e => setSaveName(e.target.value)} />
             </div>
             <div className="form-group" style={{ marginBottom: 0 }}>
               <label className="form-label">설명</label>
               <input className="input-field" value={saveDescription} onChange={e => setSaveDescription(e.target.value)} />
             </div>
             <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
               <button className="btn btn-secondary" style={{ width: '100%', height: 41 }} disabled={isSaving || !saveName.trim()}>{isSaving ? "저장 중..." : "저장"}</button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
}
