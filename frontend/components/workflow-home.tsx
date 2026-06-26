"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  DecisionRequest,
  DecisionResponse,
  actionLabel,
  formatMetrics,
  formatScore,
  parseSymbols,
  runtimeLabel,
  fetchJson,
} from "../lib/workspace";

type ExperimentSaveRequest = {
  run_id: string;
  name: string;
  description: string;
};

const agentOrder = [
  { key: "data_collection", label: "데이터 수집" },
  { key: "data_analysis", label: "데이터 분석" },
  { key: "risk_management", label: "리스크 관리" },
  { key: "buy_sell", label: "매수/매도 판단" },
  { key: "order_execution", label: "주문 실행" },
  { key: "log_evaluation", label: "로그/평가" },
] as const;

function statusForAgent(result: DecisionResponse | null, loading: boolean, agentKey: string) {
  if (loading) {
    return "실행 중";
  }
  if (!result) {
    return "대기";
  }
  if (agentKey === "order_execution" && result.orders.every((order) => !order.should_submit)) {
    return "계획 완료";
  }
  return "완료";
}

function buildDecisionRequest(
  symbols: string[],
  maxPositionWeight: number,
  mandateObjective: string,
  allowedSymbols: string[],
  excludedSymbols: string[],
  riskTolerance: "low" | "medium" | "high",
  requiresApproval: boolean,
  userNotes: string,
): DecisionRequest {
  return {
    symbols,
    max_position_weight: maxPositionWeight,
    mandate: {
      objective: mandateObjective.trim() || "Evaluate requested US equity symbols conservatively.",
      allowed_symbols: allowedSymbols,
      excluded_symbols: excludedSymbols,
      max_order_notional: null,
      min_cash_weight: null,
      risk_tolerance: riskTolerance,
      requires_approval_for_live_orders: requiresApproval,
      user_notes: userNotes.trim(),
    },
  };
}

function loadStoredResult() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("latest-workflow-result");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DecisionResponse;
  } catch {
    return null;
  }
}

function saveStoredResult(result: DecisionResponse) {
  window.localStorage.setItem("latest-workflow-result", JSON.stringify(result));
}

export function WorkflowHome() {
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT");
  const [maxPositionWeight, setMaxPositionWeight] = useState("0.2");
  const [mandateObjective, setMandateObjective] = useState("Evaluate requested US equity symbols conservatively.");
  const [allowedSymbolsInput, setAllowedSymbolsInput] = useState("");
  const [excludedSymbolsInput, setExcludedSymbolsInput] = useState("");
  const [riskTolerance, setRiskTolerance] = useState<"low" | "medium" | "high">("medium");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [userNotes, setUserNotes] = useState("");
  const [saveName, setSaveName] = useState("최근 실행 보고서");
  const [saveDescription, setSaveDescription] = useState("");
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [runState, setRunState] = useState({ run: "대기", save: "대기" });

  useEffect(() => {
    const stored = loadStoredResult();
    if (stored) {
      setResult(stored);
      setRunState({ run: "완료", save: "대기" });
    }
  }, []);

  const symbols = useMemo(() => parseSymbols(symbolsInput), [symbolsInput]);
  const allowedSymbols = useMemo(() => parseSymbols(allowedSymbolsInput), [allowedSymbolsInput]);
  const excludedSymbols = useMemo(() => parseSymbols(excludedSymbolsInput), [excludedSymbolsInput]);
  const weight = Number(maxPositionWeight);
  const hasValidWeight = Number.isFinite(weight) && weight > 0 && weight <= 1;
  const canRun = symbols.length > 0 && hasValidWeight && !isLoading;
  const canSave = Boolean(result && saveName.trim() && !isSaving);

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSaveMessage(null);
    setRunState({ run: "실행 중", save: "대기" });

    try {
      const payload = buildDecisionRequest(
        symbols,
        weight,
        mandateObjective,
        allowedSymbols,
        excludedSymbols,
        riskTolerance,
        requiresApproval,
        userNotes,
      );
      const data = await fetchJson<DecisionResponse>("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(data);
      saveStoredResult(data);
      setRunState({ run: "완료", save: "대기" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "실행 중 오류가 발생했습니다.");
      setRunState({ run: "실패", save: "대기" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveExperiment() {
    if (!result || !canSave) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload: ExperimentSaveRequest = {
        run_id: result.run_id,
        name: saveName.trim(),
        description: saveDescription.trim(),
      };
      await fetchJson("/api/experiments/from-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaveMessage("실험이 저장되었습니다. 보고서 메뉴에서 확인할 수 있습니다.");
      setRunState((current) => ({ ...current, save: "완료" }));
    } catch (requestError) {
      setSaveMessage(requestError instanceof Error ? requestError.message : "저장에 실패했습니다.");
      setRunState((current) => ({ ...current, save: "실패" }));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">메인화면</span>
          <h1>실행, 관찰, 저장을 한 흐름으로 묶는 운영 화면</h1>
          <p>
            요구사항을 넣고 실행한 뒤, 프로그램 플로우와 에이전트 결과를 바로 확인하고, 완료된 런은
            보고서 메뉴에 저장할 수 있습니다.
          </p>
        </div>
        <div className="status-card">
          <span>실행 상태</span>
          <strong>{runState.run}</strong>
          <small>저장 상태: {runState.save}</small>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <div className="section-heading">
            <span className="eyebrow">1. 요구사항</span>
            <h2>메인 에이전트로 전달할 입력</h2>
            <p>심볼, mandate, 리스크 경계를 입력하고 실행 버튼을 누르면 워크플로우가 시작됩니다.</p>
          </div>
          <form className="stack-form" onSubmit={handleRun}>
            <div className="form-grid two-cols">
              <label className="field">
                <span>심볼</span>
                <input value={symbolsInput} onChange={(event) => setSymbolsInput(event.target.value)} />
              </label>
              <label className="field">
                <span>최대 비중</span>
                <input
                  value={maxPositionWeight}
                  onChange={(event) => setMaxPositionWeight(event.target.value)}
                  inputMode="decimal"
                />
              </label>
            </div>
            <label className="field">
              <span>목표</span>
              <textarea value={mandateObjective} onChange={(event) => setMandateObjective(event.target.value)} />
            </label>
            <div className="form-grid two-cols">
              <label className="field">
                <span>허용 심볼</span>
                <input value={allowedSymbolsInput} onChange={(event) => setAllowedSymbolsInput(event.target.value)} />
              </label>
              <label className="field">
                <span>제외 심볼</span>
                <input value={excludedSymbolsInput} onChange={(event) => setExcludedSymbolsInput(event.target.value)} />
              </label>
            </div>
            <div className="form-grid two-cols">
              <label className="field">
                <span>리스크 성향</span>
                <select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as "low" | "medium" | "high")}>
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </label>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(event) => setRequiresApproval(event.target.checked)}
                />
                라이브 주문 승인 필요
              </label>
            </div>
            <label className="field">
              <span>추가 메모</span>
              <textarea value={userNotes} onChange={(event) => setUserNotes(event.target.value)} />
            </label>
            <button disabled={!canRun} type="submit">
              {isLoading ? "실행 중..." : "메인 에이전트 실행"}
            </button>
            {error ? <p className="inline-error">{error}</p> : null}
          </form>
        </article>

        <article className="panel">
          <div className="section-heading compact">
            <span className="eyebrow">2. 대시보드</span>
            <h2>현재 플로우와 에이전트 상태</h2>
          </div>
          <div className="agent-status-list">
            {agentOrder.map((agent) => (
              <div className="status-chip" key={agent.key}>
                <div>
                  <strong>{agent.label}</strong>
                  <span>{statusForAgent(result, isLoading, agent.key)}</span>
                </div>
                <small>{result ? "결과 확인 가능" : "대기 중"}</small>
              </div>
            ))}
          </div>
          <div className="runtime-block">
            <span>런타임</span>
            <strong>{result ? runtimeLabel(result.runtime) : "대기"}</strong>
            <small>{result ? `run_id ${result.run_id}` : "실행 후 상세 정보가 표시됩니다."}</small>
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="section-heading compact">
            <span className="eyebrow">3. 결과 요약</span>
            <h2>최근 실행 결과와 실험 저장</h2>
          </div>
          {result ? (
            <>
              <div className="result-summary-grid">
                <div className="summary-card">
                  <span>판단 수</span>
                  <strong>{result.evaluation_log.decision_count}</strong>
                </div>
                <div className="summary-card">
                  <span>주문 계획</span>
                  <strong>{result.evaluation_log.order_count}</strong>
                </div>
                <div className="summary-card">
                  <span>차단 주문</span>
                  <strong>{result.evaluation_log.blocked_order_count}</strong>
                </div>
                <div className="summary-card">
                  <span>심볼</span>
                  <strong>{result.symbols.join(", ")}</strong>
                </div>
              </div>
              <div className="result-columns">
                <div className="result-panel">
                  <h3>에이전트 출력</h3>
                  <div className="result-stack">
                    <section>
                      <span>데이터 수집</span>
                      {result.market_data.map((item) => (
                        <article key={item.symbol} className="output-card">
                          <strong>{item.symbol}</strong>
                          <p>가격 {item.latest_price}</p>
                          <small>{item.news_headlines.join(" / ") || "뉴스 없음"}</small>
                          <small>{formatMetrics(item.financial_metrics)}</small>
                        </article>
                      ))}
                    </section>
                    <section>
                      <span>분석 / 리스크 / 판단</span>
                      {result.decisions.map((decision) => (
                        <article key={decision.symbol} className="output-card">
                          <strong>{decision.symbol}</strong>
                          <p>
                            {actionLabel(decision.action)} · 신뢰도 {formatScore(decision.confidence)}
                          </p>
                          <small>{decision.rationale}</small>
                        </article>
                      ))}
                    </section>
                    <section>
                      <span>주문 / 평가</span>
                      {result.orders.map((order) => (
                        <article key={order.symbol} className="output-card">
                          <strong>{order.symbol}</strong>
                          <p>
                            {order.should_submit ? "제출 가능" : "제출 불가"} · 수량 {order.quantity}
                          </p>
                          <small>{order.reason}</small>
                        </article>
                      ))}
                      <article className="output-card">
                        <strong>평가</strong>
                        <p>
                          판단 {result.evaluation_log.decision_count} / 주문 {result.evaluation_log.order_count} /
                          차단 {result.evaluation_log.blocked_order_count}
                        </p>
                        <small>{result.evaluation_log.notes.join(" / ")}</small>
                      </article>
                    </section>
                  </div>
                </div>
                <div className="result-panel save-panel">
                  <h3>실험 저장</h3>
                  <label className="field">
                    <span>보고서 이름</span>
                    <input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>설명</span>
                    <textarea
                      value={saveDescription}
                      onChange={(event) => setSaveDescription(event.target.value)}
                    />
                  </label>
                  <button disabled={!canSave} onClick={() => void handleSaveExperiment()} type="button">
                    {isSaving ? "저장 중..." : "최근 런 저장"}
                  </button>
                  {saveMessage ? <p className="inline-note">{saveMessage}</p> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>아직 실행된 런이 없습니다</h3>
              <p>왼쪽의 요구사항을 입력하고 실행하면 결과 요약과 저장 패널이 활성화됩니다.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
