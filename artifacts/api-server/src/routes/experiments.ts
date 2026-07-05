import { Router, type IRouter } from "express";
import { experimentStore } from "../lib/experiment-store";

const router: IRouter = Router();

router.get("/experiments", (_req, res) => {
  const list = experimentStore.list().map(({ result: _r, decision: _d, prompt_overrides: _po, ...item }) => item);
  res.json(list);
});

router.get("/experiments/:experiment_id", (req, res) => {
  const item = experimentStore.get(req.params.experiment_id);
  if (!item) {
    res.status(404).json({ error: "실험을 찾을 수 없습니다." });
    return;
  }
  res.json(item);
});

export default router;
