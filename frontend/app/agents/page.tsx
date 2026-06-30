import Link from "next/link";

import { agentDefinitions } from "../../lib/workspace";

export default function AgentsHubPage() {
  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Agents</span>
          <h1>단계별 에이전트를 빠르게 찾아 현재 프롬프트와 출력으로 이동한다</h1>
          <p>각 단계는 같은 대시보드 디자인 안에서 열리며, 최근 메인 워크플로우 실행 결과를 기준으로 상태를 보여준다.</p>
        </div>
        <div className="hero-sidecard">
          <span>단계 수</span>
          <strong>{agentDefinitions.length}</strong>
          <small>데이터 수집부터 로그 평가까지</small>
        </div>
      </section>

      <section className="content-section">
        <div className="section-head section-head-spaced">
          <div>
            <span className="section-kicker">Workflow stage</span>
            <h2>에이전트 카탈로그</h2>
          </div>
        </div>
        <div className="card-grid card-grid-3">
          {agentDefinitions.map((item) => (
            <Link className="info-card interactive-card" href={item.path} key={item.key}>
              <div className="card-headline">
                <strong>{item.label}</strong>
                <span>상세 보기</span>
              </div>
              <p>{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
