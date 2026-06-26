"use client";

import { useEffect, useState } from "react";

import { fetchJson, ExperimentListItem, ExperimentResponse, actionLabel, formatDateTime, formatMetrics, formatPercent, formatScore, runtimeLabel } from "../lib/workspace";

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
        setSelectedId((current) => current ?? data[0].experiment_id);
        await loadExperiment(data[0].experiment_id);
      } else {
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
      setDetail(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "보고서 상세를 불러오지 못했습니다.");
    }
  }

  return (
    <main className="shell">
      <section className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">보고서 메뉴</span>
          <h1>저장된 실험의 과정과 결과를 다시 본다</h1>
          <p>메인 화면에서 저장한 최근 런이 여기에 쌓이며, 실행 입력과 결과를 함께 확인할 수 있습니다.</p>
        </div>
        <div className="status-card">
          <span>저장 개수</span>
          <strong>{items.length}</strong>
          <small>{isLoading ? "불러오는 중" : "최신순 정렬"}</small>
        </div>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}

      <section className="reports-layout">
        <aside className="panel report-list-panel">
          <div className="section-heading compact">
            <span className="eyebrow">실험 목록</span>
            <h2>최근 저장된 보고서</h2>
          </div>
          <div className="stack-list">
            {items.map((item) => (
              <button
                key={item.experiment_id}
                className={`report-card ${selectedId === item.experiment_id ? "report-card-active" : ""}`}
                onClick={() => void loadExperiment(item.experiment_id)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{formatDateTime(item.created_at)}</span>
                <small>{item.symbols.join(", ")}</small>
                <small>{runtimeLabel(item.runtime)}</small>
                <small>
                  {Object.entries(item.decision_actions)
                    .map(([symbol, action]) => `${symbol}:${actionLabel(action)}`)
                    .join(" / ")}
                </small>
              </button>
            ))}
            {!items.length && !isLoading ? (
              <div className="empty-state compact-empty">
                <h3>저장된 실험이 없습니다</h3>
                <p>메인 화면에서 최근 런을 저장하면 여기에 표시됩니다.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <article className="panel report-detail-panel">
          {detail ? (
            <>
              <div className="section-heading compact">
                <span className="eyebrow">상세 보고서</span>
                <h2>{detail.name}</h2>
                <p>{detail.description || "설명 없음"}</p>
              </div>
              <div className="result-summary-grid">
                <div className="summary-card">
                  <span>실행 시각</span>
                  <strong>{formatDateTime(detail.created_at)}</strong>
                </div>
                <div className="summary-card">
                  <span>런타임</span>
                  <strong>{runtimeLabel(detail.runtime)}</strong>
                </div>
                <div className="summary-card">
                  <span>심볼</span>
                  <strong>{detail.result.symbols.join(", ")}</strong>
                </div>
                <div className="summary-card">
                  <span>run_id</span>
                  <strong>{detail.run_id}</strong>
                </div>
              </div>
              <div className="report-stack">
                <section className="report-section">
                  <h3>입력</h3>
                  <p>최대 비중 {formatPercent(detail.decision.max_position_weight)}</p>
                  <small>{detail.decision.mandate?.objective || "mandate 없음"}</small>
                </section>
                <section className="report-section">
                  <h3>프롬프트</h3>
                  <div className="report-grid-text">
                    {Object.entries(detail.prompt_overrides).map(([key, value]) => (
                      <article className="output-card" key={key}>
                        <strong>{key}</strong>
                        <small>{value || "없음"}</small>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="report-section">
                  <h3>결과</h3>
                  <div className="report-grid-text">
                    {detail.result.decisions.map((decision) => (
                      <article className="output-card" key={decision.symbol}>
                        <strong>{decision.symbol}</strong>
                        <p>
                          {actionLabel(decision.action)} · {formatScore(decision.confidence)}
                        </p>
                        <small>{decision.rationale}</small>
                      </article>
                    ))}
                    <article className="output-card">
                      <strong>평가 요약</strong>
                      <p>
                        판단 {detail.result.evaluation_log.decision_count} / 주문 {detail.result.evaluation_log.order_count} /
                        차단 {detail.result.evaluation_log.blocked_order_count}
                      </p>
                      <small>{detail.result.evaluation_log.notes.join(" / ")}</small>
                    </article>
                  </div>
                </section>
                <section className="report-section">
                  <h3>에이전트 과정</h3>
                  <div className="report-grid-text">
                    {detail.result.market_data.map((item) => (
                      <article className="output-card" key={item.symbol}>
                        <strong>{item.symbol}</strong>
                        <p>{item.latest_price}</p>
                        <small>{formatMetrics(item.financial_metrics)}</small>
                        <small>{item.news_headlines.join(" / ") || "뉴스 없음"}</small>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>보고서를 선택하세요</h3>
              <p>왼쪽 목록에서 실험을 고르면 입력, 과정, 결과를 한 번에 확인할 수 있습니다.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
