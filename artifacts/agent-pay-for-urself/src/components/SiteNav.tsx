import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { buildApiUrl } from "../lib/api";
import { agentDefinitions, primaryNavItems } from "../lib/workspace";
import { Search, Settings, LayoutDashboard, Wallet, FileText, Bot, Activity, Layers, ShieldCheck, Link2, Database, Archive, FlaskConical } from "lucide-react";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
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
    { label: "런타임 모드", icon: <Activity size={16} />, href: "/settings" },
    { label: "정책 가드레일", icon: <ShieldCheck size={16} />, href: "/settings" },
    { label: "브로커 연결", icon: <Link2 size={16} />, href: "/account" },
    { label: "시장 데이터 소스", icon: <Database size={16} />, href: "/agents/data_collection" },
    { label: "워크플로우 기록", icon: <Archive size={16} />, href: "/reports" },
    { label: "실험 저장소", icon: <FlaskConical size={16} />, href: "/reports" },
    { label: "워크스페이스 설정", icon: <Settings size={16} />, href: "/settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        agent-pay-for-urself
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-label">Primary Navigation</div>
          {primaryNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="nav-divider" />

        <div className="nav-section">
          <div className="nav-label">Workflow Stage</div>
          {agentDefinitions.map((item) => {
            const active = isActivePath(pathname, item.path);
            return (
              <Link className={`nav-item ${active ? "active" : ""}`} href={item.path} key={item.key}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="nav-divider" />

        <div className="nav-section">
          <div className="nav-label">System</div>
          {resourceItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} key={item.label}>
                <span style={{ marginRight: 8 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className={`health-dot ${health}`} />
        <span>{health === "loading" ? "연결 확인 중" : health === "ok" ? "API 정상" : "API 오류"}</span>
      </div>
    </aside>
  );
}

export function TopHeader() {
  return (
    <header className="header">
      <div className="header-left">
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="심볼, run_id, 에이전트, 리포트 이름으로 검색…" 
          />
        </div>
      </div>
      
      <div className="header-center">
        <select className="workspace-select" defaultValue="Main Console">
          <option value="Main Console">Main Console</option>
          <option value="Research Lab">Research Lab</option>
        </select>
      </div>
      
      <div className="header-right">
        <Link href="/" className="btn btn-primary">새 실행</Link>
      </div>
    </header>
  );
}
