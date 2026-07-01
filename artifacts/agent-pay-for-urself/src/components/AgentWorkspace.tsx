import { useEffect, useMemo, useState } from "react";
import {
  AgentKey,
  AgentPromptItem,
  DecisionResponse,
  actionLabel,
  agentDefinitions,
  fetchJson,
  formatMetrics,
  formatPercent,
  formatScore,
  normalizeDecisionResponse,
} from "../lib/workspace";

type Props = {
  agentKey: AgentKey;
};

export function AgentWorkspace({ agentKey }: Props) {
  const agent = useMemo(() => agentDefinitions.find(a => a.key === agentKey) ?? agentDefinitions[0], [agentKey]);
  const [promptData, setPromptData] = useState<AgentPromptItem | null>(null);
  const [latestResult, setLatestResult] = useState<DecisionResponse | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("latest-workflow-result");
    if (raw) {
      try {
        setLatestResult(normalizeDecisionResponse(JSON.parse(raw)));
      } catch {}
    }
    
    fetchJson<AgentPromptItem[]>("/api/agent-prompts").then(data => {
      const match = data.find(d => d.agent_key === agentKey);
      if (match) setPromptData(match);
    }).catch(console.error);
  }, [agentKey]);

  const resultCards = (() => {
    if (!latestResult) return [];
    if (agentKey === "data_collection") return latestResult.market_data.map(item => ({ title: item.symbol, body: item.news_headlines.join(" / ") || "뉴스 없음", meta: `${item.latest_price} / ${formatMetrics(item.financial_metrics)}` }));
    if (agentKey === "data_analysis") return latestResult.analysis_signals.map(item => ({ title: item.symbol, body: item.rationale, meta: `총점 ${formatScore(item.total_score)}` }));
    if (agentKey === "report") return latestResult.investment_reports.map(item => ({ title: item.symbol, body: item.summary, meta: `${item.risk_approved ? "승인" : "보류"} / 비중 ${formatPercent(item.max_position_weight)}` }));
    if (agentKey === "buy_sell") return latestResult.decisions.map(item => ({ title: item.symbol, body: item.rationale, meta: `${actionLabel(item.action)} / 신뢰도 ${formatScore(item.confidence)}` }));
    if (agentKey === "order_execution") return latestResult.orders.map(item => ({ title: item.symbol, body: item.reason, meta: `${item.should_submit ? "가능" : "불가"} / 수량 ${item.quantity}` }));
    return [{ title: "로그 요약", body: latestResult.evaluation_log.notes.join(" / ") || "메모 없음", meta: `판단 ${latestResult.evaluation_log.decision_count}` }];
  })();

  return (
    <div>
      <div className="mb-8">
        <h1 className="section-title">{agent.label}</h1>
        <p className="card-subtitle">{agent.description}</p>
      </div>

      <div className="two-panel mb-8">
        <div className="card">
          <div className="flex-row justify-between mb-6">
            <h2 className="card-title" style={{ marginBottom: 0 }}>현재 프롬프트</h2>
            {promptData && <span className="badge badge-info">{promptData.source === 'default' ? '기본값' : '커스텀'}</span>}
          </div>
          <div className="form-group">
            <textarea 
              className="input-field" 
              rows={16} 
              style={{ fontFamily: 'monospace', background: 'var(--bg-main)', border: 'none' }}
              readOnly
              value={promptData?.prompt || "로딩 중..."} 
            />
          </div>
        </div>

        <div className="card">
          <h2 className="card-title mb-6">최근 실행 아웃풋</h2>
          {resultCards.length > 0 ? (
            <div className="grid-2">
              {resultCards.map((item, idx) => (
                <div className="card" style={{ boxShadow: 'none' }} key={idx}>
                  <div className="flex-row justify-between mb-4">
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.meta}</div>
                  </div>
                  <p style={{ fontSize: 13 }}>{item.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ border: 'none' }}>
              <p>최근 실행 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
