import { Switch, Route, Router as WouterRouter } from "wouter";
import { SiteNav, TopHeader } from "./components/SiteNav";
import { WorkflowHome } from "./components/WorkflowHome";
import { AccountOverview } from "./components/AccountOverview";
import { WorkflowReports } from "./components/WorkflowReports";
import { PromptSettings } from "./components/PromptSettings";
import { AgentWorkspace } from "./components/AgentWorkspace";
import { agentDefinitions, type AgentKey } from "./lib/workspace";
import "./styles.css";

function AgentsIndex() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="section-title">에이전트 목록</h1>
        <p className="card-subtitle">각 에이전트를 선택해 프롬프트와 최근 실행 결과를 확인하세요.</p>
      </div>
      <div className="grid-3">
        {agentDefinitions.map((agent) => (
          <a className="card interactive" href={agent.path} key={agent.key}>
            <h3 className="card-title">{agent.label}</h3>
            <p className="card-subtitle" style={{ marginBottom: 0 }}>{agent.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="empty-state">
      <h3>페이지를 찾을 수 없습니다</h3>
      <p>요청하신 경로가 존재하지 않습니다.</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={WorkflowHome} />
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
      <div className="app-container">
        <SiteNav />
        <div className="main-area">
          <TopHeader />
          <div className="content">
            <Router />
          </div>
        </div>
      </div>
    </WouterRouter>
  );
}

export default App;
