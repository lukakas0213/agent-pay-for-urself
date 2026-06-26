import Link from "next/link";

import { agentNavItems } from "../../lib/workspace";

export default function AgentsHubPage() {
  return (
    <main className="shell">
      <section className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">에이전트 메뉴</span>
          <h1>에이전트 허브에서 세부 단계로 분기한다</h1>
          <p>상위 메뉴는 하나로 묶고, 아래에서 필요한 에이전트를 골라 상세 프롬프트와 결과를 본다.</p>
        </div>
        <div className="status-card">
          <span>서브 메뉴</span>
          <strong>{agentNavItems.length}</strong>
          <small>각 단계별 화면으로 바로 이동</small>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <span className="eyebrow">하위 목차</span>
          <h2>에이전트별 상세 화면</h2>
          <p>아래 항목에서 단계별 화면을 선택하면 해당 에이전트의 프롬프트와 최근 실행 결과를 확인한다.</p>
        </div>
        <div className="nav-submenu">
          {agentNavItems.map((item) => (
            <Link className="nav-subpill" href={item.href} key={item.href}>
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
