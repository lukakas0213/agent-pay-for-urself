import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AgentPromptItem,
  AgentPromptSaveResponse,
  FrontendWorkspaceSettings,
  RiskTolerance,
  fetchJson,
  loadFrontendWorkspaceSettings,
  saveFrontendWorkspaceSettings,
} from "../lib/workspace";

export function PromptSettings() {
  const [prompts, setPrompts] = useState<AgentPromptItem[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
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
      setPrompts((current) => current.map((item) => (item.agent_key === response.item.agent_key ? response.item : item)));
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
    setMessage("로컬 워크스페이스 기본값을 저장했습니다.");
  }

  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>에이전트 프롬프트와 프론트 기본값을 하나의 설정 화면에서 관리한다</h1>
          <p><code>GET /agent-prompts</code>, <code>PUT /agent-prompts/{"{agent_key}"}</code>를 사용하고, 워크스페이스 기본값은 브라우저 로컬 상태에 유지한다.</p>
        </div>
        <div className="hero-sidecard">
          <span>선택된 프롬프트</span>
          <strong>{selectedPrompt?.label || "없음"}</strong>
          <small>{selectedPrompt?.source === "default" ? "기본값" : "사용자 저장값"}</small>
        </div>
      </section>

      {message ? <div className="banner banner-success">{message}</div> : null}

      <section className="dashboard-grid">
        <aside className="panel">
          <div className="section-head">
            <div>
              <span className="section-kicker">Prompt list</span>
              <h2>에이전트 프롬프트</h2>
            </div>
          </div>
          <div className="stack-list">
            {prompts.map((item) => (
              <button
                className={`list-card ${selectedKey === item.agent_key ? "list-card-active" : ""}`}
                key={item.agent_key}
                onClick={() => setSelectedKey(item.agent_key)}
                type="button"
              >
                <strong>{item.label}</strong>
                <span>{item.source === "default" ? "기본값" : "사용자 저장값"}</span>
                <small>{item.updated_at}</small>
              </button>
            ))}
            {!prompts.length && !isLoading ? (
              <div className="empty-panel compact-empty-panel">
                <h3>프롬프트가 없습니다</h3>
                <p>백엔드 프롬프트 API를 확인하세요.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <article className="panel panel-span-2">
          <div className="section-head">
            <div>
              <span className="section-kicker">Prompt editor</span>
              <h2>{selectedPrompt?.label || "프롬프트 선택"}</h2>
            </div>
          </div>
          <form className="form-stack" onSubmit={handleSavePrompt}>
            <label className="field">
              <span>프롬프트 본문</span>
              <textarea rows={16} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <button className="primary-button" disabled={isSavingPrompt || isLoading || !selectedPrompt} type="submit">
              {isSavingPrompt ? "저장 중..." : "프롬프트 저장"}
            </button>
          </form>
        </article>
      </section>

      <section className="content-section">
        <div className="section-head section-head-spaced">
          <div>
            <span className="section-kicker">Workspace defaults</span>
            <h2>프론트 기본값</h2>
          </div>
        </div>
        {settings ? (
          <article className="panel">
            <form className="form-stack" onSubmit={handleSaveLocalSettings}>
              <div className="field-grid field-grid-2">
                <label className="field">
                  <span>기본 심볼</span>
                  <input value={settings.default_symbols} onChange={(event) => updateSetting("default_symbols", event.target.value)} />
                </label>
                <label className="field">
                  <span>기본 최대 비중</span>
                  <input
                    value={settings.default_max_position_weight}
                    onChange={(event) => updateSetting("default_max_position_weight", event.target.value)}
                  />
                </label>
              </div>
              <div className="field-grid field-grid-2">
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
              <div className="toggle-row">
                <label className="toggle-chip">
                  <input
                    checked={settings.auto_apply_chat_followups}
                    onChange={(event) => updateSetting("auto_apply_chat_followups", event.target.checked)}
                    type="checkbox"
                  />
                  후속 채팅 자동 반영
                </label>
                <label className="toggle-chip">
                  <input
                    checked={settings.auto_trading_enabled}
                    onChange={(event) => updateSetting("auto_trading_enabled", event.target.checked)}
                    type="checkbox"
                  />
                  자동매매 승인 기본값
                </label>
              </div>
              <div className="field-grid field-grid-2">
                <label className="field">
                  <span>계좌 별칭</span>
                  <input value={settings.account_alias} onChange={(event) => updateSetting("account_alias", event.target.value)} />
                </label>
                <label className="field">
                  <span>브로커 이름</span>
                  <input value={settings.broker_label} onChange={(event) => updateSetting("broker_label", event.target.value)} />
                </label>
              </div>
              <button className="primary-button" type="submit">
                로컬 설정 저장
              </button>
            </form>
          </article>
        ) : null}
      </section>
    </main>
  );
}
