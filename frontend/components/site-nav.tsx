
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
          <strong>운영 콘솔</strong>
          <p>메인 실행, 계좌, 보고서, 에이전트 프롬프트를 한 화면 체계로 묶습니다.</p>
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
