import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/console/interactions", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message : "";

  res.json({
    focus: "general",
    reply: `메시지를 수신했습니다: "${message}". AI 백엔드 연동 후 워크플로우 반영 결과가 반환됩니다.`,
    suggested_actions: ["AI 모델 연동 후 실제 후속 조치를 추천합니다."],
    applied_to_workflow: false,
    updated_run_id: null,
    updated_result: null,
  });
});

export default router;
