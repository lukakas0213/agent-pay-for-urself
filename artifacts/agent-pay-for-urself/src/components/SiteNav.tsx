import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import { buildApiUrl } from "../lib/api";
import { agentDefinitions, primaryNavItems } from "../lib/workspace";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function sectionIcon(label: string) {
  return label.slice(0, 1);
}

export function SiteNav() {
  const [pathname] = useLocation();
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let active = true;
    void fetch(buildApiUrl("/api/health"))
      .then((response) => {
        if (active) {
          setHealth(response.ok ? "ok" : "error");
        }
      })
      .catch(() => {
        if (active) {
          setHealth("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const resourceItems = [
    { label: "런타임 모드", href: "/reports", count: "Live" },
    { label: "정책 가드레일", href: "/agents/log_evaluation", count: "1" },
    { label: "브로커 연결", href: "/account", count: "KIS" },
    { label: "시장 데이터 소스", href: "/agents/data_collection", count: "MD" },
    { label: "워크플로우 기록", href: "/reports", count: "Runs" },
    { label: "실험 저장소", href: "/reports", count: "Repo" },
    { label: "워크스페이스 설정", href: "/settings", count: "Cfg" },
  ];

  return (
    <aside className="sidebar">
        <div className="sidebar-workspace">
          <div className="workspace-lockup">
            <div className="workspace-logo" aria-hidden="true">
              <span />
            </div>
            <div>
              <strong>agent-pay-for-urself</strong>
              <p>Main Console</p>
            </div>
          </div>
        </div>

        <div className="sidebar-stack">
          <nav className="sidebar-group" aria-label="Primary navigation">
            <div className="sidebar-group-head">
              <span>Navigation</span>
            </div>
            <div className="sidebar-list">
              {primaryNavItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                    href={item.href}
                    key={item.href}
                  >
                    <span className="sidebar-icon" aria-hidden="true">{sectionIcon(item.label)}</span>
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="sidebar-group">
            <div className="sidebar-group-head">
              <span>Workflow Stage</span>
            </div>
            <div className="sidebar-list">
              {agentDefinitions.map((item) => {
                const active = isActivePath(pathname, item.path);
                return (
                  <Link
                    className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                    href={item.path}
                    key={item.key}
                  >
                    <span className="sidebar-icon" aria-hidden="true">{sectionIcon(item.label)}</span>
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="sidebar-group sidebar-group-resources">
            <div className="sidebar-group-head">
              <span>Resources</span>
            </div>
            <div className="sidebar-list sidebar-list-dense">
              {resourceItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    className={`sidebar-link sidebar-link-resource ${active ? "sidebar-link-active" : ""}`}
                    href={item.href}
                    key={item.label}
                  >
                    <span className="sidebar-label">{item.label}</span>
                    <small className="resource-count">{item.count}</small>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-health">
            <span className={`system-dot system-dot-${health}`} />
            <span>{health === "loading" ? "연결 확인 중" : health === "ok" ? "API 정상" : "API 오류"}</span>
          </div>
          <strong>Ontology-style console layout</strong>
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
        <Link className="topbar-button" href="/#new-run">
          새 실행
        </Link>
      </div>
    </header>
  );
}
