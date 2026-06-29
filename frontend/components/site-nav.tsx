"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { agentNavItems, primaryNavItems } from "../lib/workspace";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function SiteNav() {
  const pathname = usePathname();
  const showAgentSubnav = pathname === "/agents" || pathname.startsWith("/agents/");

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand-block">
          <span className="eyebrow">agent-pay-for-urself</span>
          <strong>투자 워크플로우 콘솔</strong>
          <p>메인 채팅, 자동매매 승인, 에이전트 타임라인, 보고서, 계좌 상태, 프롬프트 설정을 한 흐름으로 정리했습니다.</p>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {primaryNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link className={`nav-pill ${active ? "nav-pill-active" : ""}`} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
          {showAgentSubnav ? (
            <div className="nav-group">
              <div className="nav-submenu" aria-label="Agent subsections">
                {agentNavItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      className={`nav-subpill ${active ? "nav-subpill-active" : ""}`}
                      href={item.href}
                      key={item.href}
                    >
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
