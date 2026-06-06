const agents = [
  "데이터 수집",
  "데이터 분석",
  "리스크 관리",
  "매수/매도 판단",
  "주문 실행",
  "로그/평가",
];

export default function Home() {
  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <h1>agent-pay-for-urself</h1>
          <p>한국투자증권 기반 미국 주식 투자 의사결정을 위한 멀티 에이전트 운영 화면</p>
        </div>
        <button type="button">분석 시작</button>
      </section>

      <section className="grid">
        {agents.map((agent) => (
          <article className="agent-card" key={agent}>
            <span>{agent}</span>
            <strong>대기</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
