import { Router, type IRouter } from "express";
import { listWorkflowRuns, getWorkflowRun } from "../lib/history-store";
import type { WorkflowResult } from "../engine/schemas";

const router: IRouter = Router();

type AgentConnectionStatus = "running" | "connected" | "disconnected";

interface AgentStatusItem {
  agent_key: string;
  label: string;
  status: AgentConnectionStatus;
}

interface TimelineEventItem {
  event_id: string;
  agent_key: string | null;
  title: string;
  detail: string;
  status: AgentConnectionStatus;
  created_at: string;
}

interface AnalysisSummaryItem {
  symbol: string;
  total_score: number;
  summary: string;
}

interface WorkflowRunListItem {
  run_id: string;
  created_at: string;
  symbols: string[];
  objective: string;
  summary: string;
  report_approved_count: number;
  report_count: number;
  decision_actions: Record<string, string>;
}

interface WorkflowRunDetailResponse {
  run_id: string;
  created_at: string;
  agent_statuses: AgentStatusItem[];
  timeline: TimelineEventItem[];
  analysis_summaries: AnalysisSummaryItem[];
  result: WorkflowResult;
}

const AGENT_LABELS: Array<[string, string]> = [
  ["main_agent", "메인 에이전트"],
  ["data_collection", "데이터 수집"],
  ["data_analysis", "데이터 분석"],
  ["report", "보고서"],
  ["buy_sell", "매수/매도"],
  ["feedback", "피드백"],
];

function buildAgentStatuses(result: WorkflowResult): AgentStatusItem[] {
  const statusByKey: Record<string, AgentConnectionStatus> = {
    main_agent: "connected",
    data_collection: result.market_data.length > 0 ? "connected" : "disconnected",
    data_analysis: result.analysis_signals.length > 0 ? "connected" : "disconnected",
    report: result.investment_reports.length > 0 ? "connected" : "disconnected",
    buy_sell: result.decisions.length > 0 ? "connected" : "disconnected",
    feedback: result.feedback.summary ? "connected" : "disconnected",
  };
  return AGENT_LABELS.map(([agent_key, label]) => ({
    agent_key,
    label,
    status: statusByKey[agent_key] ?? "disconnected",
  }));
}

function buildTimeline(result: WorkflowResult): TimelineEventItem[] {
  const eventSpecs: Array<[string, string, string, AgentConnectionStatus]> = [
    [
      "main_agent",
      "메인 에이전트 지시 확정",
      result.supervisor_directive.summary || result.supervisor_directive.objective,
      "connected",
    ],
    [
      "data_collection",
      "시장 데이터 수집",
      `${result.market_data.length}개 종목 데이터 수집 완료`,
      result.market_data.length > 0 ? "connected" : "disconnected",
    ],
    [
      "data_analysis",
      "분석 신호 생성",
      `${result.analysis_signals.length}개 분석 신호 생성 완료`,
      result.analysis_signals.length > 0 ? "connected" : "disconnected",
    ],
    [
      "report",
      "보고서 생성",
      `${result.investment_reports.length}개 보고서 작성 완료`,
      result.investment_reports.length > 0 ? "connected" : "disconnected",
    ],
    [
      "buy_sell",
      "매수/매도 결정",
      `${result.decisions.length}개 최종 판단 생성 완료`,
      result.decisions.length > 0 ? "connected" : "disconnected",
    ],
    [
      "feedback",
      "시스템 피드백 생성",
      result.feedback.follow_up_actions[0] ?? result.feedback.summary,
      result.feedback.summary ? "connected" : "disconnected",
    ],
  ];
  return eventSpecs.map(([agent_key, title, detail, status], index) => ({
    event_id: `${result.run_id}:${index + 1}`,
    agent_key,
    title,
    detail,
    status,
    created_at: result.created_at,
  }));
}

function buildAnalysisSummaries(result: WorkflowResult): AnalysisSummaryItem[] {
  const reportSummaryBySymbol: Record<string, string> = {};
  for (const item of result.investment_reports) {
    reportSummaryBySymbol[item.symbol] = item.summary;
  }
  return result.analysis_signals.map((item) => ({
    symbol: item.symbol,
    total_score: item.total_score,
    summary: reportSummaryBySymbol[item.symbol] ?? item.rationale,
  }));
}

function toListItem(result: WorkflowResult): WorkflowRunListItem {
  const approvedCount = result.investment_reports.filter((r) => r.risk_approved).length;
  const decisionActions: Record<string, string> = {};
  for (const d of result.decisions) {
    decisionActions[d.symbol] = d.action;
  }
  return {
    run_id: result.run_id,
    created_at: result.created_at,
    symbols: result.symbols,
    objective: result.supervisor_directive.objective,
    summary: result.supervisor_directive.summary || result.user_prompt,
    report_approved_count: approvedCount,
    report_count: result.investment_reports.length,
    decision_actions: decisionActions,
  };
}

function toDetailResponse(result: WorkflowResult): WorkflowRunDetailResponse {
  return {
    run_id: result.run_id,
    created_at: result.created_at,
    agent_statuses: buildAgentStatuses(result),
    timeline: buildTimeline(result),
    analysis_summaries: buildAnalysisSummaries(result),
    result,
  };
}

router.get("/runs", (_req, res) => {
  const runs = listWorkflowRuns();
  res.json(runs.map(toListItem));
});

router.get("/runs/:run_id", (req, res) => {
  const run = getWorkflowRun(req.params.run_id);
  if (!run) {
    res.status(404).json({ error: `workflow run not found: ${req.params.run_id}` });
    return;
  }
  res.json(toDetailResponse(run));
});

export default router;
