import { Router, type IRouter } from "express";
import type { WorkflowResult } from "../engine/schemas";
import { getWorkflowRun } from "../lib/history-store";

const router: IRouter = Router();

interface ExperimentRecord {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  symbols: string[];
  decision_actions: Record<string, string>;
  runtime: WorkflowResult["runtime"] | null;
  result: WorkflowResult;
  decision: {
    symbols: string[];
    max_position_weight: number;
    mandate: WorkflowResult["mandate"] | null;
  };
  prompt_overrides: Record<string, string>;
}

const store: ExperimentRecord[] = [];

router.get("/experiments", (_req, res) => {
  const list = store.map(({ result: _r, decision: _d, prompt_overrides: _po, ...item }) => item);
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

  const name = typeof body.name === "string" ? body.name : "저장된 실행";
  const description = typeof body.description === "string" ? body.description : "";
  const runId = typeof body.run_id === "string" ? body.run_id : null;

  let result: WorkflowResult | null = null;

  if (runId) {
    result = getWorkflowRun(runId) ?? null;
    if (!result) {
      res.status(404).json({ error: "저장된 실행 결과를 찾을 수 없습니다." });
      return;
    }
  } else if (body.result && typeof body.result === "object") {
    result = body.result as WorkflowResult;
  }

  if (!result) {
    res.status(422).json({
      error: "run_id 또는 result 필드가 필요합니다.",
    });
    return;
  }

  const experimentId = `exp-${Date.now()}`;

  const decisionActions: Record<string, string> = {};
  for (const d of result.decisions ?? []) {
    decisionActions[d.symbol] = d.action;
  }

  const experiment: ExperimentRecord = {
    experiment_id: experimentId,
    run_id: result.run_id,
    name,
    description,
    created_at: new Date().toISOString(),
    symbols: result.symbols,
    decision_actions: decisionActions,
    runtime: result.runtime ?? null,
    result,
    decision: {
      symbols: result.symbols,
      max_position_weight: result.mandate.max_position_weight,
      mandate: result.mandate,
    },
    prompt_overrides: {},
  };

  store.unshift(experiment);
  res.status(201).json({ experiment_id: experimentId, message: "저장되었습니다." });
});

export default router;
