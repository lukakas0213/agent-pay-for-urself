import Link from "next/link";

import { agentNavItems } from "../../lib/workspace";

export default function AgentsHubPage() {
  return (
    <main className="shell">
      <section className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">에이전트 메뉴</span>
          <h1>단계별 에이전트를 한곳에서 찾아보고 점검합니다</h1>
          <p>어떤 단계가 어떤 역할을 하는지 먼저 보고, 필요한 화면으로 바로 이동해 프롬프트와 최근 출력을 확인할 수 있습니다.</p>
        </div>
        <div className="status-card">
          <span>서브 메뉴</span>
          <strong>{agentNavItems.length}</strong>
          <small>각 단계별 화면으로 이동</small>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <span className="eyebrow">하위 목차</span>
          <h2>필요한 단계만 골라 들어가세요</h2>
          <p>메인 화면에서 실행한 뒤 여기로 오면, 각 단계가 어떤 데이터를 만들었는지 더 자세히 볼 수 있습니다.</p>
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
