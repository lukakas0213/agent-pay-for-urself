import { Switch, Route, Router as WouterRouter } from "wouter";
import { Link } from "wouter";
import { SiteNav, Topbar } from "./components/SiteNav";
import { WorkflowHome } from "./components/WorkflowHome";
import { AccountOverview } from "./components/AccountOverview";
import { WorkflowReports } from "./components/WorkflowReports";
import { PromptSettings } from "./components/PromptSettings";
import { AgentWorkspace } from "./components/AgentWorkspace";
import { HistoryTimeline } from "./components/HistoryTimeline";
import { agentDefinitions, type AgentKey } from "./lib/workspace";
import "./styles.css";

function AgentsIndex() {
  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Agents</span>
          <h1>에이전트 목록</h1>
          <p>메인 에이전트와 각 실행 에이전트를 선택해 프롬프트와 최근 실행 결과를 확인하세요.</p>
        </div>
      </section>
      <div className="card-grid card-grid-3">
        {agentDefinitions.map((agent) => (
          <Link href={agent.path} key={agent.key}>
            <article className="info-card interactive-card">
              <strong>{agent.label}</strong>
              <p>{agent.description}</p>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="dashboard-page">
      <div className="empty-panel">
        <h3>페이지를 찾을 수 없습니다</h3>
        <p>요청하신 경로가 존재하지 않습니다.</p>
      </div>
    </main>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={WorkflowHome} />
      <Route path="/history" component={HistoryTimeline} />
      <Route path="/account" component={AccountOverview} />
      <Route path="/reports" component={WorkflowReports} />
      <Route path="/settings" component={PromptSettings} />
      <Route path="/agents" component={AgentsIndex} />
      <Route path="/agents/:agentKey">
        {(params) => {
          const key = params.agentKey as AgentKey;
          const valid = agentDefinitions.some((item) => item.key === key);
          if (!valid) return <NotFound />;
          return <AgentWorkspace agentKey={key} />;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <div className="app-shell">
        <SiteNav />
        <div className="app-main">
          <Topbar />
          <div className="app-content">
            <Router />
          </div>
        </div>
      </div>
    </WouterRouter>
  );
}

export default App;
