import { useEffect, useState } from "react";
import { fetchJson, formatDateTime, formatScore } from "../lib/workspace";

type AgentConnectionStatus = "running" | "connected" | "disconnected";

interface AgentStatusItem {
  agent_key: string;
  label: string;
  status: AgentConnectionStatus;
}

interface TimelineEventItem {
  event_id: string;
  agent_key: string | null;
  title: string;
  detail: string;
  status: AgentConnectionStatus;
  created_at: string;
}

interface AnalysisSummaryItem {
  symbol: string;
  total_score: number;
  summary: string;
}

interface WorkflowRunListItem {
  run_id: string;
  created_at: string;
  symbols: string[];
  objective: string;
  summary: string;
  report_approved_count: number;
  report_count: number;
  decision_actions: Record<string, string>;
}

interface WorkflowRunDetailResponse {
  run_id: string;
  created_at: string;
  agent_statuses: AgentStatusItem[];
  timeline: TimelineEventItem[];
  analysis_summaries: AnalysisSummaryItem[];
}

const ACTION_LABELS: Record<string, string> = {
  BUY: "매수",
  SELL: "매도",
  HOLD: "보유",
};

function statusLabel(s: AgentConnectionStatus) {
  if (s === "connected") return "완료";
  if (s === "running") return "실행중";
  return "미실행";
}

export function HistoryTimeline() {
  const [runs, setRuns] = useState<WorkflowRunListItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowRunDetailResponse | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (selectedRunId) void loadDetail(selectedRunId);
  }, [selectedRunId]);

  async function loadRuns() {
    setIsLoadingRuns(true);
    setError(null);
    try {
      const data = await fetchJson<WorkflowRunListItem[]>("/api/runs");
      setRuns(data);
      if (data.length > 0) setSelectedRunId(data[0].run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "히스토리를 불러오지 못했습니다.");
    } finally {
      setIsLoadingRuns(false);
    }
  }

  async function loadDetail(runId: string) {
    setIsLoadingDetail(true);
    setDetail(null);
    try {
      const data = await fetchJson<WorkflowRunDetailResponse>(`/api/runs/${runId}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상세 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  const selectedRun = runs.find((r) => r.run_id === selectedRunId) ?? null;

  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">History</span>
          <h1>히스토리 타임라인</h1>
          <p>에이전트가 수행한 작업을 시간순으로 추적합니다.</p>
        </div>
        <div className="hero-sidecard">
          <span>총 실행</span>
          <strong>{runs.length}건</strong>
          <small>{isLoadingRuns ? "불러오는 중" : "기록됨"}</small>
        </div>
      </section>

      {error ? <div className="banner banner-error">{error}</div> : null}

      {isLoadingRuns ? (
        <div className="empty-panel"><p>실행 기록을 불러오는 중...</p></div>
      ) : runs.length === 0 ? (
        <div className="empty-panel">
          <h3>아직 실행 기록이 없습니다</h3>
          <p>대시보드에서 워크플로우를 실행하면 여기에 타임라인이 기록됩니다.</p>
        </div>
      ) : (
        <div className="history-layout">
          <div className="history-run-list panel">
            <div className="section-head">
              <div>
                <span className="section-kicker">Run List</span>
                <h2>실행 목록</h2>
              </div>
              <button type="button" className="secondary-button" onClick={loadRuns}>
                새로고침
              </button>
            </div>
            <div className="run-list-items">
              {runs.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  className={`run-list-item ${selectedRunId === run.run_id ? "run-list-item-active" : ""}`}
                  onClick={() => setSelectedRunId(run.run_id)}
                >
                  <div className="run-list-item-head">
                    <span className="run-list-item-id">{run.run_id.slice(0, 14)}…</span>
                    <span className="run-list-item-time">{formatDateTime(run.created_at)}</span>
                  </div>
                  <p className="run-list-item-objective">{run.objective || run.summary || "—"}</p>
                  <div className="run-list-item-footer">
                    <div className="discover-chip-row">
                      {run.symbols.slice(0, 4).map((s) => (
                        <span key={s} className="discover-chip">{s}</span>
                      ))}
                    </div>
                    {Object.keys(run.decision_actions).length > 0 && (
                      <div className="run-decision-badges">
                        {Object.entries(run.decision_actions).map(([sym, action]) => (
                          <span key={sym} className={`run-decision-badge run-badge-${action.toLowerCase()}`}>
                            {sym} {ACTION_LABELS[action] ?? action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="history-detail">
            {isLoadingDetail ? (
              <div className="empty-panel"><p>상세 정보 불러오는 중...</p></div>
            ) : !detail ? (
              <div className="empty-panel">
                <h3>실행을 선택하세요</h3>
                <p>왼쪽 목록에서 실행 항목을 클릭하면 에이전트 상태와 타임라인이 표시됩니다.</p>
              </div>
            ) : (
              <div className="stack-blocks">
                {selectedRun && (
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <span className="section-kicker">Run Context</span>
                        <h2>{selectedRun.objective || "실행 요약"}</h2>
                      </div>
                      <span className="support-text" style={{ fontSize: "0.82rem" }}>
                        {formatDateTime(detail.created_at)}
                      </span>
                    </div>
                    <p style={{ marginBottom: 12 }}>{selectedRun.summary}</p>
                    <div className="stat-grid stat-grid-4">
                      <div className="stat-card">
                        <span>종목</span>
                        <strong>{selectedRun.symbols.join(", ")}</strong>
                      </div>
                      <div className="stat-card">
                        <span>보고서</span>
                        <strong>{selectedRun.report_approved_count} / {selectedRun.report_count}</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="panel">
                  <div className="section-head">
                    <div>
                      <span className="section-kicker">Agent Status</span>
                      <h2>에이전트 상태</h2>
                    </div>
                  </div>
                  <div className="agent-status-grid">
                    {detail.agent_statuses.map((agent) => (
                      <div key={agent.agent_key} className={`agent-status-item agent-status-${agent.status}`}>
                        <span className="agent-status-dot" />
                        <div>
                          <strong>{agent.label}</strong>
                          <small>{statusLabel(agent.status)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <div className="section-head">
                    <div>
                      <span className="section-kicker">Timeline</span>
                      <h2>실행 타임라인</h2>
                    </div>
                  </div>
                  <div className="timeline-list">
                    {detail.timeline.map((event, index) => (
                      <div key={event.event_id} className={`timeline-item timeline-item-${event.status}`}>
                        <div className="timeline-connector">
                          <span className="timeline-dot" />
                          {index < detail.timeline.length - 1 ? <span className="timeline-line" /> : null}
                        </div>
                        <div className="timeline-body">
                          <div className="timeline-title">{event.title}</div>
                          <div className="timeline-detail">{event.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.analysis_summaries.length > 0 && (
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <span className="section-kicker">Analysis Summary</span>
                        <h2>종목별 분석 요약</h2>
                      </div>
                    </div>
                    <div className="card-grid card-grid-2">
                      {detail.analysis_summaries.map((item) => (
                        <div key={item.symbol} className="metric-card">
                          <strong>{item.symbol}</strong>
                          <span>총점 {formatScore(item.total_score)}</span>
                          <p>{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
