import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AgentKey,
  AgentPromptItem,
  AgentPromptSaveResponse,
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

function loadLatestResult() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("latest-workflow-result");
  if (!raw) {
    return null;
  }

  try {
    return normalizeDecisionResponse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function promptSummary(prompt: string) {
  const cleaned = prompt.trim();
  if (!cleaned) {
    return "저장된 프롬프트 없음";
  }
  return cleaned.length > 220 ? `${cleaned.slice(0, 220)}...` : cleaned;
}

export function AgentWorkspace({ agentKey }: Props) {
  const agent = useMemo(() => agentDefinitions.find((item) => item.key === agentKey) ?? agentDefinitions[0], [agentKey]);
  const [prompts, setPrompts] = useState<AgentPromptItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<DecisionResponse | null>(null);

  useEffect(() => {
    setLatestResult(loadLatestResult());
    void loadPrompts();
  }, [agentKey]);

  async function loadPrompts() {
    setIsLoading(true);
    setMessage(null);
    try {
      const data = await fetchJson<AgentPromptItem[]>("/api/agent-prompts");
      setPrompts(data);
      const current = data.find((item) => item.agent_key === agentKey) ?? data[0];
      if (current) {
        setPrompt(current.prompt);
        setUpdatedAt(current.updated_at);
        setSource(current.source);
      }
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "프롬프트를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const data = await fetchJson<AgentPromptSaveResponse>(`/api/agent-prompts/${agentKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setPrompt(data.item.prompt);
      setUpdatedAt(data.item.updated_at);
      setSource(data.item.source);
      setMessage("프롬프트를 저장했습니다.");
      const reloaded = await fetchJson<AgentPromptItem[]>("/api/agent-prompts");
      setPrompts(reloaded);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const resultCards = (() => {
    if (!latestResult) {
      return [] as Array<{ title: string; body: string; meta: string }>;
    }

    if (agentKey === "data_collection") {
      return latestResult.market_data.map((item) => ({
        title: item.symbol,
        body: item.news_headlines.join(" / ") || "뉴스 없음",
        meta: `${item.latest_price} / ${formatMetrics(item.financial_metrics)}`,
      }));
    }

    if (agentKey === "data_analysis") {
      return latestResult.analysis_signals.map((item) => ({
        title: item.symbol,
        body: item.rationale,
        meta: `총점 ${formatScore(item.total_score)} / 가격 ${formatScore(item.price_score)}`,
      }));
    }

    if (agentKey === "report") {
      return latestResult.investment_reports.map((item) => ({
        title: item.symbol,
        body: item.summary,
        meta: `${item.risk_approved ? "리스크 승인" : "리스크 보류"} / 최대 비중 ${formatPercent(item.max_position_weight)}`,
      }));
    }

    if (agentKey === "buy_sell") {
      return latestResult.decisions.map((item) => ({
        title: item.symbol,
        body: item.rationale,
        meta: `${actionLabel(item.action)} / ${formatScore(item.confidence)}`,
      }));
    }

    if (agentKey === "order_execution") {
      return latestResult.orders.map((item) => ({
        title: item.symbol,
        body: item.reason,
        meta: `${item.should_submit ? "제출 가능" : "제출 불가"} / 수량 ${item.quantity}`,
      }));
    }

    return [
      {
        title: "평가 로그",
        body: latestResult.evaluation_log.notes.join(" / ") || "후속 메모 없음",
        meta: `판단 ${latestResult.evaluation_log.decision_count} / 주문 ${latestResult.evaluation_log.order_count}`,
      },
    ];
  })();

  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Agent Detail</span>
          <h1>{agent.label}</h1>
          <p>{agent.description} 저장된 프롬프트와 최근 실행 결과를 같은 화면에서 점검한다.</p>
        </div>
        <div className="hero-sidecard">
          <span>프롬프트 상태</span>
          <strong>{source === "default" ? "기본값" : "사용자 저장값"}</strong>
          <small>{updatedAt || "업데이트 전"}</small>
        </div>
      </section>

      {message ? <div className="banner banner-success">{message}</div> : null}

      <section className="dashboard-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <span className="section-kicker">Prompt editor</span>
              <h2>현재 프롬프트</h2>
            </div>
          </div>
          <form className="form-stack" onSubmit={handleSave}>
            <label className="field">
              <span>프롬프트</span>
              <textarea rows={16} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <button className="primary-button" disabled={isSaving || isLoading} type="submit">
              {isSaving ? "저장 중..." : "프롬프트 저장"}
            </button>
          </form>
        </article>

        <article className="panel panel-span-2">
          <div className="section-head">
            <div>
              <span className="section-kicker">Latest output</span>
              <h2>최근 실행에서의 출력</h2>
            </div>
          </div>
          {resultCards.length ? (
            <div className="card-grid card-grid-2">
              {resultCards.map((item) => (
                <article className="info-card" key={`${item.title}-${item.meta}`}>
                  <strong>{item.title}</strong>
                  <span className="card-meta">{item.meta}</span>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <h3>최근 실행 결과가 없습니다</h3>
              <p>메인 화면에서 워크플로우를 실행하면 해당 에이전트의 결과가 여기에 표시됩니다.</p>
            </div>
          )}
        </article>
      </section>

      <section className="content-section">
        <div className="section-head section-head-spaced">
          <div>
            <span className="section-kicker">Prompt registry</span>
            <h2>등록된 프롬프트 미리보기</h2>
          </div>
        </div>
        <div className="card-grid card-grid-3">
          {prompts.map((item) => (
            <article className={`info-card ${item.agent_key === agentKey ? "selected-card" : ""}`} key={item.agent_key}>
              <strong>{item.label}</strong>
              <span className="card-meta">{item.source === "default" ? "기본값" : "사용자 저장값"}</span>
              <p>{promptSummary(item.prompt)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
