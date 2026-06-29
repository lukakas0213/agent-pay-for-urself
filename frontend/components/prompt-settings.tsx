"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AgentPromptItem,
  AgentPromptSaveResponse,
  FrontendWorkspaceSettings,
  RiskTolerance,
  agentDefinitions,
  fetchJson,
  loadFrontendWorkspaceSettings,
  saveFrontendWorkspaceSettings,
} from "../lib/workspace";

export function PromptSettings() {
  const [prompts, setPrompts] = useState<AgentPromptItem[]>([]);
  const [selectedKey, setSelectedKey] = useState(agentDefinitions[0].key);
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);

  useEffect(() => {
    setSettings(loadFrontendWorkspaceSettings());
    void loadPrompts();
  }, []);

  const selectedPrompt = useMemo(
    () => prompts.find((item) => item.agent_key === selectedKey) ?? prompts[0] ?? null,
    [prompts, selectedKey],
  );

  useEffect(() => {
    if (selectedPrompt) {
      setPrompt(selectedPrompt.prompt);
    }
  }, [selectedPrompt]);

  async function loadPrompts() {
    setIsLoading(true);
    setMessage(null);
    try {
      const data = await fetchJson<AgentPromptItem[]>("/api/agent-prompts");
      setPrompts(data);
      if (data[0]) {
        setSelectedKey(data[0].agent_key);
      }
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "프롬프트를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSavePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrompt) {
      return;
    }

    setIsSavingPrompt(true);
    setMessage(null);
    try {
      const response = await fetchJson<AgentPromptSaveResponse>(`/api/agent-prompts/${selectedPrompt.agent_key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setPrompt(response.item.prompt);
      setPrompts((current) =>
        current.map((item) => (item.agent_key === response.item.agent_key ? response.item : item)),
      );
      setMessage("선택한 에이전트 프롬프트를 저장했습니다.");
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "프롬프트 저장에 실패했습니다.");
    } finally {
      setIsSavingPrompt(false);
    }
  }

  function updateSetting<K extends keyof FrontendWorkspaceSettings>(key: K, value: FrontendWorkspaceSettings[K]) {
    if (!settings) {
      return;
    }
    setSettings({ ...settings, [key]: value });
  }

  function handleSaveLocalSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }
    saveFrontendWorkspaceSettings(settings);
    setMessage("메인화면과 계좌 화면에서 사용하는 로컬 설정을 저장했습니다.");
  }

  return (
    <main className="shell">
      <section className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">프롬프트 설정</span>
          <h1>에이전트 프롬프트와 세부 실행 설정을 조정한다</h1>
          <p>각 에이전트의 기본 프롬프트를 수정하고, 메인화면에서 불러올 기본 심볼/리스크/채팅 자동반영 설정을 함께 관리합니다.</p>
        </div>
        <div className="status-card">
          <span>설정 상태</span>
          <strong>{selectedPrompt?.label || "프롬프트 없음"}</strong>
          <small>{selectedPrompt?.source === "default" ? "기본값" : "사용자 저장값"}</small>
        </div>
      </section>

      {message ? <p className="inline-note">{message}</p> : null}

      <section className="settings-layout">
        <aside className="panel settings-sidebar">
          <div className="section-heading compact">
            <span className="eyebrow">에이전트 목록</span>
            <h2>수정할 프롬프트 선택</h2>
          </div>
          <div className="settings-agent-list">
            {prompts.map((item) => (
              <button
                key={item.agent_key}
                className={`report-card ${selectedKey === item.agent_key ? "report-card-active" : ""}`}
                onClick={() => setSelectedKey(item.agent_key)}
                type="button"
              >
                <strong>{item.label}</strong>
                <small>{item.source === "default" ? "기본값" : "사용자 저장값"}</small>
                <small>{item.updated_at}</small>
              </button>
            ))}
            {!prompts.length && !isLoading ? (
              <div className="empty-state compact-empty">
                <h3>프롬프트가 없습니다</h3>
                <p>백엔드 프롬프트 API를 확인하세요.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <article className="panel report-detail-panel">
          <div className="section-heading compact">
            <span className="eyebrow">프롬프트 편집</span>
            <h2>{selectedPrompt?.label || "선택 필요"}</h2>
          </div>
          <form className="stack-form" onSubmit={handleSavePrompt}>
            <label className="field">
              <span>프롬프트 본문</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <button disabled={isSavingPrompt || isLoading || !selectedPrompt} type="submit">
              {isSavingPrompt ? "저장 중..." : "프롬프트 저장"}
            </button>
          </form>
        </article>

        <article className="panel panel-span-2 report-detail-panel">
          <div className="section-heading compact">
            <span className="eyebrow">세부 설정</span>
            <h2>메인화면과 계좌 화면 기본값</h2>
            <p>이 설정은 현재 브라우저 로컬 스토리지에 저장되며, 별도 서버 계약을 만들지 않습니다.</p>
          </div>
          {settings ? (
            <form className="stack-form" onSubmit={handleSaveLocalSettings}>
              <div className="form-grid two-cols">
                <label className="field">
                  <span>기본 심볼</span>
                  <input
                    value={settings.default_symbols}
                    onChange={(event) => updateSetting("default_symbols", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>기본 최대 비중</span>
                  <input
                    value={settings.default_max_position_weight}
                    onChange={(event) => updateSetting("default_max_position_weight", event.target.value)}
                  />
                </label>
              </div>
              <div className="form-grid two-cols">
                <label className="field">
                  <span>기본 리스크 성향</span>
                  <select
                    value={settings.default_risk_tolerance}
                    onChange={(event) => updateSetting("default_risk_tolerance", event.target.value as RiskTolerance)}
                  >
                    <option value="low">낮음</option>
                    <option value="medium">보통</option>
                    <option value="high">높음</option>
                  </select>
                </label>
                <label className="field">
                  <span>타임라인 보관 수</span>
                  <input
                    inputMode="numeric"
                    value={settings.timeline_limit}
                    onChange={(event) => updateSetting("timeline_limit", Number(event.target.value) || 12)}
                  />
                </label>
              </div>
              <div className="form-grid two-cols">
                <label className="toggle-field toggle-card">
                  <input
                    checked={settings.auto_apply_chat_followups}
                    onChange={(event) => updateSetting("auto_apply_chat_followups", event.target.checked)}
                    type="checkbox"
                  />
                  후속 채팅을 워크플로우에 자동 반영
                </label>
                <label className="toggle-field toggle-card">
                  <input
                    checked={settings.auto_trading_enabled}
                    onChange={(event) => updateSetting("auto_trading_enabled", event.target.checked)}
                    type="checkbox"
                  />
                  자동매매 승인 기본값 활성화
                </label>
              </div>
              <div className="form-grid two-cols">
                <label className="field">
                  <span>계좌 별칭</span>
                  <input value={settings.account_alias} onChange={(event) => updateSetting("account_alias", event.target.value)} />
                </label>
                <label className="field">
                  <span>브로커 이름</span>
                  <input value={settings.broker_label} onChange={(event) => updateSetting("broker_label", event.target.value)} />
                </label>
              </div>
              <button type="submit">로컬 설정 저장</button>
            </form>
          ) : null}
        </article>
      </section>
    </main>
  );
}
