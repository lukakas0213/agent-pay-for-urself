import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import { buildApiUrl } from "../lib/api";
import { agentDefinitions } from "../lib/workspace";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, prefix: string) {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function SiteNav() {
  const [pathname] = useLocation();
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let active = true;
    void fetch(buildApiUrl("/api/health"))
      .then((r) => { if (active) setHealth(r.ok ? "ok" : "error"); })
      .catch(() => { if (active) setHealth("error"); });
    return () => { active = false; };
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-workspace">
        <div className="workspace-lockup">
          <div className="workspace-logo" aria-hidden="true"><span /></div>
          <div>
            <strong>agent-pay-for-urself</strong>
            <p>Main Console</p>
          </div>
        </div>
      </div>

      <div className="sidebar-stack">
        <nav className="sidebar-group" aria-label="대시보드">
          <div className={`sidebar-group-head ${isGroupActive(pathname, "/") ? "sidebar-group-head-active" : ""}`}>
            <span className="sidebar-group-icon">대</span>
            <Link href="/" className="sidebar-group-label">대시보드</Link>
          </div>
          <div className="sidebar-sub-list">
            <Link href="/" className={`sidebar-sub-link ${pathname === "/" ? "sidebar-sub-link-active" : ""}`}>
              메인 에이전트 소통
            </Link>
          </div>
        </nav>

        <nav className="sidebar-group" aria-label="에이전트">
          <div className={`sidebar-group-head ${isGroupActive(pathname, "/agents") ? "sidebar-group-head-active" : ""}`}>
            <span className="sidebar-group-icon">에</span>
            <Link href="/agents" className="sidebar-group-label">에이전트</Link>
          </div>
          <div className="sidebar-sub-list">
            <Link
              href="/agents"
              className={`sidebar-sub-link ${pathname === "/agents" ? "sidebar-sub-link-active" : ""}`}
            >
              메인 에이전트
            </Link>
            {agentDefinitions.map((agent) => (
              <Link
                key={agent.key}
                href={agent.path}
                className={`sidebar-sub-link ${pathname === agent.path ? "sidebar-sub-link-active" : ""}`}
              >
                {agent.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav className="sidebar-group" aria-label="히스토리">
          <div className={`sidebar-group-head ${isGroupActive(pathname, "/history") ? "sidebar-group-head-active" : ""}`}>
            <span className="sidebar-group-icon">히</span>
            <Link href="/history" className="sidebar-group-label">히스토리</Link>
          </div>
          <div className="sidebar-sub-list">
            <Link
              href="/history"
              className={`sidebar-sub-link ${pathname === "/history" ? "sidebar-sub-link-active" : ""}`}
            >
              전체 요약 히스토리
            </Link>
            {agentDefinitions.map((agent) => {
              const href = `/history/agent/${agent.key}`;
              return (
                <Link
                  key={agent.key}
                  href={href}
                  className={`sidebar-sub-link ${pathname === href ? "sidebar-sub-link-active" : ""}`}
                >
                  {agent.label} 히스토리
                </Link>
              );
            })}
          </div>
        </nav>

        <nav className="sidebar-group" aria-label="보고서">
          <div className={`sidebar-group-head ${isGroupActive(pathname, "/reports") ? "sidebar-group-head-active" : ""}`}>
            <span className="sidebar-group-icon">보</span>
            <Link href="/reports" className="sidebar-group-label">보고서</Link>
          </div>
          <div className="sidebar-sub-list">
            <Link href="/reports" className={`sidebar-sub-link ${isActive(pathname, "/reports") ? "sidebar-sub-link-active" : ""}`}>
              보고서 확인
            </Link>
          </div>
        </nav>

        <nav className="sidebar-group" aria-label="계좌">
          <div className={`sidebar-group-head ${isGroupActive(pathname, "/account") ? "sidebar-group-head-active" : ""}`}>
            <span className="sidebar-group-icon">계</span>
            <Link href="/account" className="sidebar-group-label">계좌</Link>
          </div>
          <div className="sidebar-sub-list">
            <Link
              href="/account"
              className={`sidebar-sub-link ${pathname === "/account" ? "sidebar-sub-link-active" : ""}`}
            >
              계좌 연결
            </Link>
            <Link
              href="/account/status"
              className={`sidebar-sub-link ${pathname === "/account/status" ? "sidebar-sub-link-active" : ""}`}
            >
              계좌 상태 확인
            </Link>
          </div>
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-health">
          <span className={`system-dot system-dot-${health}`} />
          <span>{health === "loading" ? "연결 확인 중" : health === "ok" ? "API 정상" : "API 오류"}</span>
        </div>
      </div>
    </aside>
  );
}

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-title">투자 워크플로우 콘솔</div>
      <div className="topbar-search">
        <input aria-label="Search" placeholder="심볼, run_id, 에이전트, 리포트 이름으로 검색…" />
      </div>
      <div className="topbar-actions">
        <label className="workspace-select">
          <span className="sr-only">Workspace selector</span>
          <select defaultValue="Main Console">
            <option>Main Console</option>
            <option>Research Lab</option>
          </select>
        </label>
        <Link className="topbar-button" href="/">
          새 실행
        </Link>
      </div>
    </header>
  );
}
