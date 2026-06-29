"use client";

import { useEffect, useState } from "react";

import {
  ExperimentListItem,
  ExperimentResponse,
  actionLabel,
  fetchJson,
  formatDateTime,
  formatMetrics,
  formatPercent,
  normalizeDecisionResponse,
  formatScore,
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
      setDetail({
        ...data,
        result: normalizeDecisionResponse(data.result) ?? data.result,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "보고서 상세를 불러오지 못했습니다.");
    }
  }

  return (
    <main className="shell">
      <section className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">보고서 메뉴</span>
          <h1>주문 전 보고서와 저장된 실행 흐름을 다시 본다</h1>
          <p>데이터 수집, 분석, 보고서 작성, 최종 판단이 어떻게 이어졌는지 저장된 런 단위로 복기합니다.</p>
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
                  <span>보고서 승인</span>
                  <strong>
                    {approvedReportCount(detail)} / {detail.result.investment_reports.length}
                  </strong>
                </div>
                <div className="summary-card">
                  <span>run_id</span>
                  <strong>{detail.run_id}</strong>
                </div>
              </div>

              <div className="directive-card report-directive-card">
                <span>메인 에이전트 요약</span>
                <strong>{detail.result.supervisor_directive.summary || "요약 없음"}</strong>
                <small>watch 심볼: {detail.result.supervisor_directive.watch_symbols.join(", ") || "없음"}</small>
              </div>

              <div className="execution-strip report-execution-strip">
                <article className="execution-step">
                  <span>데이터 수집</span>
                  <strong>{detail.result.market_data.length}</strong>
                </article>
                <article className="execution-step">
                  <span>데이터 분석</span>
                  <strong>{detail.result.analysis_signals.length}</strong>
                </article>
                <article className="execution-step">
                  <span>보고서 작성</span>
                  <strong>{detail.result.investment_reports.length}</strong>
                </article>
                <article className="execution-step">
                  <span>주문 계획</span>
                  <strong>{detail.result.orders.length}</strong>
                </article>
              </div>

              <div className="report-stack">
                <section className="report-section">
                  <h3>입력과 제약</h3>
                  <div className="report-grid-text">
                    <article className="output-card">
                      <strong>메인 목표</strong>
                      <small>{detail.result.user_prompt || detail.decision.mandate?.objective || "없음"}</small>
                    </article>
                    <article className="output-card">
                      <strong>최대 비중</strong>
                      <small>{formatPercent(detail.decision.max_position_weight)}</small>
                    </article>
                    <article className="output-card">
                      <strong>채팅 지시</strong>
                      <small>{detail.result.chat_messages.join(" / ") || "없음"}</small>
                    </article>
                    <article className="output-card">
                      <strong>가이드</strong>
                      <small>{detail.result.supervisor_directive.guidance.join(" / ") || "없음"}</small>
                    </article>
                  </div>
                </section>

                <section className="report-section">
                  <h3>주문 전 보고서</h3>
                  <div className="report-preview-grid">
                    {detail.result.investment_reports.map((report) => (
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
                            <span>하락 포인트</span>
                            <small>{report.bear_points.join(" / ") || "없음"}</small>
                          </div>
                        </div>
                        <small className="report-flags">{report.risk_flags.join(" / ") || "리스크 메모 없음"}</small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="report-section">
                  <h3>결과와 주문 계획</h3>
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
                    {detail.result.orders.map((order) => (
                      <article className="output-card" key={`${order.symbol}-${order.action}`}>
                        <strong>{order.symbol}</strong>
                        <p>{order.should_submit ? "제출 가능" : "제출 불가"} · 수량 {order.quantity}</p>
                        <small>{order.reason}</small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="report-section">
                  <h3>수집 데이터</h3>
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
