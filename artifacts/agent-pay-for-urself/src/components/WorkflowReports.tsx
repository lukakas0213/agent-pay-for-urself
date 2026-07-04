import { useEffect, useState } from "react";

import {
  ExperimentListItem,
  ExperimentResponse,
  actionLabel,
  fetchJson,
  formatDateTime,
  formatMetrics,
  formatPercent,
  formatScore,
  normalizeDecisionResponse,
  runtimeLabel,
} from "../lib/workspace";

function approvedReportCount(detail: ExperimentResponse) {
  return detail.result.investment_reports.filter((report) => report.risk_approved).length;
}

export function WorkflowReports() {
  const [items, setItems] = useState<ExperimentListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExperimentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadExperiments();
  }, []);

  async function loadExperiments() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchJson<ExperimentListItem[]>("/api/experiments");
      setItems(data);
      if (data.length > 0) {
        const nextSelectedId =
          selectedId && data.some((item) => item.experiment_id === selectedId)
            ? selectedId
            : data[0].experiment_id;
        await loadExperiment(nextSelectedId);
      } else {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "보고서를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadExperiment(experimentId: string) {
    setSelectedId(experimentId);
    setError(null);
    try {
      const data = await fetchJson<ExperimentResponse>(`/api/experiments/${experimentId}`);
      setDetail({
        ...data,
        result: normalizeDecisionResponse(data.result) ?? data.result,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "보고서 상세를 불러오지 못했습니다.");
    }
  }

  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Reports</span>
          <h1>저장된 실행 결과를 리스트와 상세 패널로 나눠 복기한다</h1>
          <p>
            <code>GET /experiments</code>와 <code>{"GET /experiments/{experiment_id}"}</code> 응답을 그대로 읽어 저장된 보고서의 단계별 결과를 재구성한다.
          </p>
        </div>
        <div className="hero-sidecard">
          <span>저장 개수</span>
          <strong>{items.length}</strong>
          <small>{isLoading ? "불러오는 중" : "최신순 목록"}</small>
        </div>
      </section>

      {error ? <div className="banner banner-error">{error}</div> : null}

      <section className="dashboard-grid">
        <aside className="panel report-list-panel">
          <div className="section-head">
            <div>
              <span className="section-kicker">Experiment list</span>
              <h2>보고서 저장소</h2>
            </div>
            <button className="secondary-button" onClick={() => void loadExperiments()} type="button">
              새로고침
            </button>
          </div>
          <div className="stack-list">
            {items.map((item) => (
              <button
                className={`list-card ${selectedId === item.experiment_id ? "list-card-active" : ""}`}
                key={item.experiment_id}
                onClick={() => void loadExperiment(item.experiment_id)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{formatDateTime(item.created_at)}</span>
                <small>{item.symbols.join(", ")}</small>
                <small>{runtimeLabel(item.runtime)}</small>
              </button>
            ))}
            {!items.length && !isLoading ? (
              <div className="empty-panel compact-empty-panel">
                <h3>저장된 보고서가 없습니다</h3>
                <p>메인 화면에서 실행 결과를 저장하면 이 목록에 나타난다.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <article className="panel panel-span-2">
          {detail ? (
            <div className="stack-blocks">
              <div className="section-head">
                <div>
                  <span className="section-kicker">Report detail</span>
                  <h2>{detail.name}</h2>
                </div>
                <span className="status-badge">{runtimeLabel(detail.runtime)}</span>
              </div>
              <p className="support-text">{detail.description || "설명 없음"}</p>
              <div className="stat-grid stat-grid-4">
                <div className="stat-card">
                  <span>생성 시각</span>
                  <strong>{formatDateTime(detail.created_at)}</strong>
                </div>
                <div className="stat-card">
                  <span>보고서 승인</span>
                  <strong>{approvedReportCount(detail)} / {detail.result.investment_reports.length}</strong>
                </div>
                <div className="stat-card">
                  <span>판단 수</span>
                  <strong>{detail.result.decisions.length}</strong>
                </div>
                <div className="stat-card">
                  <span>run_id</span>
                  <strong>{detail.run_id}</strong>
                </div>
              </div>

              <div className="metric-card metric-card-accent">
                <span>메인 에이전트 요약</span>
                <strong>{detail.result.supervisor_directive.summary || "요약 없음"}</strong>
                <p>{detail.result.supervisor_directive.guidance.join(" / ") || "가이드 없음"}</p>
              </div>

              <section className="content-section compact-section">
                <div className="section-head section-head-spaced">
                  <div>
                    <span className="section-kicker">Input and mandate</span>
                    <h2>입력과 제약</h2>
                  </div>
                </div>
                <div className="card-grid card-grid-2">
                  <article className="info-card">
                    <strong>메인 목표</strong>
                    <p>{detail.result.user_prompt || detail.decision.mandate?.objective || "없음"}</p>
                  </article>
                  <article className="info-card">
                    <strong>채팅 지시</strong>
                    <p>{detail.result.chat_messages.join(" / ") || "없음"}</p>
                  </article>
                  <article className="info-card">
                    <strong>최대 비중</strong>
                    <p>{formatPercent(detail.decision.max_position_weight)}</p>
                  </article>
                  <article className="info-card">
                    <strong>watch 심볼</strong>
                    <p>{detail.result.supervisor_directive.watch_symbols.join(", ") || "없음"}</p>
                  </article>
                </div>
              </section>

              <section className="content-section compact-section">
                <div className="section-head section-head-spaced">
                  <div>
                    <span className="section-kicker">Investment reports</span>
                    <h2>주문 전 보고서</h2>
                  </div>
                </div>
                <div className="card-grid card-grid-2">
                  {detail.result.investment_reports.map((report) => (
                    <article className="info-card" key={report.symbol}>
                      <div className="card-headline">
                        <strong>{report.symbol}</strong>
                        <span>{report.risk_approved ? "리스크 승인" : "리스크 보류"}</span>
                      </div>
                      <p>{report.summary}</p>
                      <span className="card-meta">{actionLabel(report.recommended_action_bias)} · {formatScore(report.signal_strength)}</span>
                      <small>상승 포인트: {report.bull_points.join(" / ") || "없음"}</small>
                      <small>하락 포인트: {report.bear_points.join(" / ") || "없음"}</small>
                      <small>리스크 플래그: {report.risk_flags.join(" / ") || "없음"}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className="content-section compact-section">
                <div className="section-head section-head-spaced">
                  <div>
                    <span className="section-kicker">Decisions and feedback</span>
                    <h2>최종 판단과 시스템 피드백</h2>
                  </div>
                </div>
                <div className="card-grid card-grid-2">
                  {detail.result.decisions.map((decision) => (
                    <article className="info-card" key={`${decision.symbol}-decision`}>
                      <strong>{decision.symbol}</strong>
                      <p>{actionLabel(decision.action)} · {formatScore(decision.confidence)}</p>
                      <small>{decision.rationale}</small>
                    </article>
                  ))}
                  <article className="info-card" key="workflow-feedback">
                    <strong>피드백 에이전트</strong>
                    <p>{detail.result.feedback.summary || "요약 없음"}</p>
                    <small>후속 액션: {detail.result.feedback.follow_up_actions.join(" / ") || "없음"}</small>
                    <small>수집 피드백: {detail.result.feedback.collection_feedback.join(" / ") || "없음"}</small>
                    <small>분석 피드백: {detail.result.feedback.analysis_feedback.join(" / ") || "없음"}</small>
                  </article>
                </div>
              </section>

              <section className="content-section compact-section">
                <div className="section-head section-head-spaced">
                  <div>
                    <span className="section-kicker">Collected data</span>
                    <h2>수집 데이터</h2>
                  </div>
                </div>
                <div className="card-grid card-grid-2">
                  {detail.result.market_data.map((item) => (
                    <article className="info-card" key={item.symbol}>
                      <strong>{item.symbol}</strong>
                      <p>{item.latest_price}</p>
                      <small>{formatMetrics(item.financial_metrics)}</small>
                      <small>{item.news_headlines.join(" / ") || "뉴스 없음"}</small>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="empty-panel">
              <h3>보고서를 선택하세요</h3>
              <p>왼쪽 목록에서 저장된 실행을 선택하면 상세 결과가 여기에 열린다.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
