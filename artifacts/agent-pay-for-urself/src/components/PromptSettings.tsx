import { useEffect, useState } from "react";
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
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);

  useEffect(() => {
    setSettings(loadFrontendWorkspaceSettings());
    void loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      const data = await fetchJson<AgentPromptItem[]>("/api/agent-prompts");
      setPrompts(data);
      if (data[0]) {
        setSelectedKey(data[0].agent_key);
        setPrompt(data[0].prompt);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const selectedPrompt = prompts.find(p => p.agent_key === selectedKey);

  function handleSelect(key: string) {
    setSelectedKey(key);
    const p = prompts.find(x => x.agent_key === key);
    if (p) setPrompt(p.prompt);
  }

  async function handleSavePrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPrompt) return;
    try {
      const response = await fetchJson<AgentPromptSaveResponse>(`/api/agent-prompts/${selectedPrompt.agent_key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setPrompts(current => current.map(item => item.agent_key === response.item.agent_key ? response.item : item));
      alert("프롬프트가 저장되었습니다.");
    } catch (err) {
      alert("저장 실패");
    }
  }

  function updateSetting<K extends keyof FrontendWorkspaceSettings>(key: K, value: FrontendWorkspaceSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function handleSaveLocalSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    saveFrontendWorkspaceSettings(settings);
    alert("로컬 워크스페이스 기본값이 저장되었습니다.");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="section-title">설정</h1>
        <p className="card-subtitle">에이전트 프롬프트와 프론트엔드 워크스페이스 기본값을 관리합니다.</p>
      </div>

      <div className="two-panel mb-8">
        <div className="list-container">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-main)' }}>
             <h2 className="card-title" style={{ marginBottom: 0 }}>프롬프트 목록</h2>
          </div>
          {prompts.map(item => (
            <button
              key={item.agent_key}
              className={`list-item ${selectedKey === item.agent_key ? 'selected' : ''}`}
              onClick={() => handleSelect(item.agent_key)}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.source === 'default' ? '기본값' : '사용자 저장값'}</div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="flex-row justify-between mb-6">
            <h2 className="card-title" style={{ marginBottom: 0 }}>{selectedPrompt?.label || "에이전트 선택"}</h2>
            {selectedPrompt && <span className="badge badge-info">{selectedPrompt.source === 'default' ? '기본값' : '사용자 커스텀'}</span>}
          </div>
          <form onSubmit={handleSavePrompt}>
            <div className="form-group">
              <label className="form-label">프롬프트 에디터</label>
              <textarea 
                className="input-field" 
                rows={16} 
                style={{ fontFamily: 'monospace' }}
                value={prompt} 
                onChange={e => setPrompt(e.target.value)} 
                disabled={!selectedPrompt}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!selectedPrompt}>저장</button>
          </form>
        </div>
      </div>

      {settings && (
        <div className="card">
          <h2 className="card-title mb-6">로컬 워크스페이스 기본값</h2>
          <form onSubmit={handleSaveLocalSettings}>
            <div className="grid-2 mb-6">
              <div className="form-group">
                <label className="form-label">기본 심볼</label>
                <input className="input-field" value={settings.default_symbols} onChange={e => updateSetting('default_symbols', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">기본 최대 비중</label>
                <input className="input-field" value={settings.default_max_position_weight} onChange={e => updateSetting('default_max_position_weight', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">기본 리스크 성향</label>
                <select className="input-field" value={settings.default_risk_tolerance} onChange={e => updateSetting('default_risk_tolerance', e.target.value as RiskTolerance)}>
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
            </div>
            <div className="flex-row gap-4 mb-6">
              <div className="flex-row gap-2">
                <input type="checkbox" id="autoChat" checked={settings.auto_apply_chat_followups} onChange={e => updateSetting('auto_apply_chat_followups', e.target.checked)} />
                <label htmlFor="autoChat" className="form-label" style={{ marginBottom: 0 }}>후속 채팅 자동 반영</label>
              </div>
              <div className="flex-row gap-2">
                <input type="checkbox" id="autoTrade" checked={settings.auto_trading_enabled} onChange={e => updateSetting('auto_trading_enabled', e.target.checked)} />
                <label htmlFor="autoTrade" className="form-label" style={{ marginBottom: 0 }}>자동매매 승인 기본값</label>
              </div>
            </div>
            <button className="btn btn-secondary" type="submit">기본값 저장</button>
          </form>
        </div>
      )}
    </div>
  );
}
