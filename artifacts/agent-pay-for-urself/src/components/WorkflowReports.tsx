import { useEffect, useState } from "react";
import {
  ExperimentListItem,
  ExperimentResponse,
  actionLabel,
  fetchJson,
  formatDateTime,
  normalizeDecisionResponse,
  runtimeLabel,
} from "../lib/workspace";

export function WorkflowReports() {
  const [items, setItems] = useState<ExperimentListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExperimentResponse | null>(null);

  useEffect(() => {
    void loadExperiments();
  }, []);

  async function loadExperiments() {
    try {
      const data = await fetchJson<ExperimentListItem[]>("/api/experiments");
      setItems(data);
      if (data.length > 0) {
        setSelectedId(data[0].experiment_id);
        await loadExperiment(data[0].experiment_id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadExperiment(id: string) {
    setSelectedId(id);
    try {
      const data = await fetchJson<ExperimentResponse>(`/api/experiments/${id}`);
      setDetail({
        ...data,
        result: normalizeDecisionResponse(data.result) ?? data.result,
      });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="section-title">보고서 저장소</h1>
        <p className="card-subtitle">저장된 워크플로우 실행 결과를 확인합니다.</p>
      </div>

      <div className="two-panel">
        <div className="list-container">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-main)' }}>
             <h2 className="card-title" style={{ marginBottom: 0 }}>목록 ({items.length})</h2>
          </div>
          {items.map(item => (
            <button
              key={item.experiment_id}
              className={`list-item ${selectedId === item.experiment_id ? 'selected' : ''}`}
              onClick={() => loadExperiment(item.experiment_id)}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{item.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateTime(item.created_at)}</div>
              <div className="flex-row gap-2 mt-4">
                {item.symbols.map(s => <span key={s} className="badge badge-hold">{s}</span>)}
              </div>
            </button>
          ))}
          {items.length === 0 && <div className="empty-state" style={{ border: 'none' }}><p>보고서가 없습니다.</p></div>}
        </div>

        <div>
          {detail ? (
            <div className="card">
              <div className="flex-row justify-between mb-6">
                 <div>
                   <h2 className="card-title">{detail.name}</h2>
                   <p className="card-subtitle">{detail.description || "설명 없음"}</p>
                 </div>
                 <span className="badge badge-info">{runtimeLabel(detail.runtime)}</span>
              </div>

              <div className="grid-4 mb-8">
                <div>
                  <div className="form-label">생성 일시</div>
                  <div style={{ fontWeight: 600 }}>{formatDateTime(detail.created_at)}</div>
                </div>
                <div>
                  <div className="form-label">판단 수</div>
                  <div style={{ fontWeight: 600 }}>{detail.result.decisions.length}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div className="form-label">Run ID</div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{detail.run_id}</div>
                </div>
              </div>

              <div className="mb-8" style={{ padding: 16, background: 'var(--accent-subtle)', borderRadius: 'var(--radius-lg)' }}>
                 <div className="form-label" style={{ color: 'var(--accent-primary)' }}>메인 에이전트 요약</div>
                 <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{detail.result.supervisor_directive.summary || "요약 없음"}</div>
              </div>

              <h3 className="card-title mb-6">종목별 판단 및 주문 계획</h3>
              <div className="grid-2">
                {detail.result.decisions.map(d => (
                  <div className="card" style={{ boxShadow: 'none' }} key={d.symbol}>
                    <div className="flex-row justify-between mb-6">
                      <div style={{ fontWeight: 600 }}>{d.symbol}</div>
                      <span className={`badge ${d.action === 'BUY' ? 'badge-buy' : d.action === 'SELL' ? 'badge-sell' : 'badge-hold'}`}>
                        {actionLabel(d.action)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13 }}>{d.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state card">
              <p>왼쪽 목록에서 보고서를 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
