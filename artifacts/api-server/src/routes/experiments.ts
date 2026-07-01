import { Router, type IRouter } from "express";

const router: IRouter = Router();

type Experiment = {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  symbols: string[];
  decision_actions: Record<string, string>;
  runtime: null;
  result: unknown;
  decision: {
    symbols: string[];
    max_position_weight: number;
    mandate: null;
  };
  prompt_overrides: Record<string, string>;
};

const store: Experiment[] = [];

router.get("/experiments", (_req, res) => {
  const list = store.map(({ result: _r, decision: _d, prompt_overrides: _p, ...item }) => item);
  res.json(list);
});

router.get("/experiments/:experiment_id", (req, res) => {
  const item = store.find((e) => e.experiment_id === req.params.experiment_id);
  if (!item) {
    res.status(404).json({ error: "실험을 찾을 수 없습니다." });
    return;
  }
  res.json(item);
});

router.post("/experiments/from-run", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const runId = typeof body.run_id === "string" ? body.run_id : `run-${Date.now()}`;
  const name = typeof body.name === "string" ? body.name : "저장된 실행";
  const description = typeof body.description === "string" ? body.description : "";
  const experimentId = `exp-${Date.now()}`;

  const experiment: Experiment = {
    experiment_id: experimentId,
    run_id: runId,
    name,
    description,
    created_at: new Date().toISOString(),
    symbols: [],
    decision_actions: {},
    runtime: null,
    result: { run_id: runId, symbols: [], user_prompt: "", chat_messages: [], runtime: null, mandate: { objective: name, allowed_symbols: [], excluded_symbols: [], max_position_weight: 0.2, max_order_notional: null, min_cash_weight: null, risk_tolerance: "medium", requires_approval_for_live_orders: true, user_notes: "" }, supervisor_directive: { objective: name, focus_symbols: [], watch_symbols: [], guidance: [], summary: description }, market_data: [], analysis_signals: [], investment_reports: [], decisions: [], orders: [], evaluation_log: { decision_count: 0, order_count: 0, blocked_order_count: 0, notes: [] }, mandate_violations: [] },
    decision: { symbols: [], max_position_weight: 0.2, mandate: null },
    prompt_overrides: {},
  };

  store.unshift(experiment);
  res.status(201).json({ experiment_id: experimentId, message: "저장되었습니다." });
});

export default router;
