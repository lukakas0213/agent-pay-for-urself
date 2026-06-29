"use client";

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
  normalizeDecisionResponse,
  formatPercent,
  formatScore,
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
  const agent = useMemo(
    () => agentDefinitions.find((item) => item.key === agentKey) ?? agentDefinitions[0],
    [agentKey],
  );
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
      setMessage("프롬프트가 저장되었습니다.");
      const reloaded = await fetchJson<AgentPromptItem[]>("/api/agent-prompts");
      setPrompts(reloaded);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const resultSection = (() => {
    if (!latestResult) {
      return (
        <div className="empty-state compact-empty">
          <h3>최근 실행 결과가 없습니다</h3>
          <p>메인 화면에서 워크플로우를 실행하면 여기에서 해당 에이전트의 출력을 확인할 수 있습니다.</p>
        </div>
      );
    }

    if (agentKey === "data_collection") {
      return latestResult.market_data.map((item) => (
        <article className="output-card" key={item.symbol}>
          <strong>{item.symbol}</strong>
          <p>{item.latest_price}</p>
          <small>{item.news_headlines.join(" / ") || "뉴스 없음"}</small>
          <small>{formatMetrics(item.financial_metrics)}</small>
        </article>
      ));
    }

    if (agentKey === "data_analysis") {
      return latestResult.analysis_signals.map((item) => (
        <article className="output-card" key={item.symbol}>
          <strong>{item.symbol}</strong>
          <p>
            {formatScore(item.total_score)} / {formatScore(item.price_score)} / {formatScore(item.news_score)}
          </p>
          <small>{item.rationale}</small>
        </article>
      ));
    }

    if (agentKey === "report") {
      return latestResult.investment_reports.map((item) => (
        <article className="output-card" key={item.symbol}>
          <strong>{item.symbol}</strong>
          <p>
            {item.risk_approved ? "리스크 승인" : "리스크 보류"} · {actionLabel(item.recommended_action_bias)}
          </p>
          <small>{item.summary}</small>
          <small>최대 비중 {formatPercent(item.max_position_weight)}</small>
        </article>
      ));
    }

    if (agentKey === "buy_sell") {
      return latestResult.decisions.map((item) => (
        <article className="output-card" key={item.symbol}>
          <strong>{item.symbol}</strong>
          <p>
            {actionLabel(item.action)} · {formatScore(item.confidence)}
          </p>
          <small>{item.rationale}</small>
        </article>
      ));
    }

    if (agentKey === "order_execution") {
      return latestResult.orders.map((item) => (
        <article className="output-card" key={item.symbol}>
          <strong>{item.symbol}</strong>
          <p>{item.should_submit ? "제출 가능" : "제출 불가"} · 수량 {item.quantity}</p>
          <small>{item.reason}</small>
        </article>
      ));
    }

    return (
      <article className="output-card">
        <strong>평가</strong>
        <p>
          판단 {latestResult.evaluation_log.decision_count} / 주문 {latestResult.evaluation_log.order_count} /
          차단 {latestResult.evaluation_log.blocked_order_count}
        </p>
        <small>{latestResult.evaluation_log.notes.join(" / ")}</small>
      </article>
    );
  })();

  return (
    <main className="shell">
      <section className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">{agent.label}</span>
          <h1>{agent.description}</h1>
          <p>현재 저장된 프롬프트를 수정하고, 최근 실행에서 이 에이전트가 낸 결과를 바로 확인합니다.</p>
        </div>
        <div className="status-card">
          <span>프롬프트 상태</span>
          <strong>{source === "default" ? "기본값" : "저장됨"}</strong>
          <small>{updatedAt || "업데이트 전"}</small>
        </div>
      </section>

      <section className="reports-layout">
        <article className="panel report-detail-panel">
          <div className="section-heading compact">
            <span className="eyebrow">프롬프트 편집</span>
            <h2>현재 프롬프트</h2>
          </div>
          <form className="stack-form" onSubmit={handleSave}>
            <label className="field">
              <span>프롬프트</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <button disabled={isSaving || isLoading} type="submit">
              {isSaving ? "저장 중..." : "프롬프트 저장"}
            </button>
          </form>
          {message ? <p className="inline-note">{message}</p> : null}
          <div className="prompt-list-preview">
            <h3>등록된 프롬프트 목록</h3>
            {prompts.map((item) => (
              <article className={`prompt-preview ${item.agent_key === agentKey ? "prompt-preview-active" : ""}`} key={item.agent_key}>
                <strong>{item.label}</strong>
                <small>{promptSummary(item.prompt)}</small>
              </article>
            ))}
          </div>
        </article>

        <article className="panel report-detail-panel">
          <div className="section-heading compact">
            <span className="eyebrow">러닝 출력</span>
            <h2>최근 실행에서의 에이전트 결과</h2>
          </div>
          {resultSection}
        </article>
      </section>
    </main>
  );
}
