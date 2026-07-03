import { Router, type IRouter } from "express";
import { runWorkflow } from "../engine/orchestrator";
import type { WorkflowResult } from "../engine/schemas";
import { addWorkflowRun, getWorkflowRun } from "../lib/history-store";

const router: IRouter = Router();

router.post("/console/interactions", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const runId = typeof body.run_id === "string" ? body.run_id : null;
  const storedResult = runId ? getWorkflowRun(runId) ?? null : null;

  if (runId && !storedResult) {
    res.status(404).json({ error: `workflow run not found: ${runId}` });
    return;
  }

  const existingResult = storedResult ??
    (body.current_result && typeof body.current_result === "object"
      ? (body.current_result as WorkflowResult)
      : null);
  const applyToWorkflow = typeof body.apply_to_workflow === "boolean" ? body.apply_to_workflow : true;

  const symbols: string[] = existingResult?.symbols ??
    (Array.isArray(body.symbols) ? (body.symbols as unknown[]).map(String) : []);

  const chatMessages: string[] = existingResult?.chat_messages
    ? [...existingResult.chat_messages, message]
    : [message];

  if (!message) {
    res.status(422).json({ error: "message 필드가 필요합니다." });
    return;
  }

  if (symbols.length === 0) {
    res.json({
      focus: "general",
      reply: `메시지를 수신했습니다: "${message}". 종목을 지정하면 워크플로우 결과를 업데이트할 수 있습니다.`,
      suggested_actions: ["종목 티커(예: AAPL, TSLA)를 포함하여 다시 요청하세요."],
      applied_to_workflow: false,
      updated_run_id: runId,
      updated_result: existingResult,
    });
    return;
  }

  if (!applyToWorkflow) {
    res.json({
      focus: "conversation",
      reply: `메시지를 반영해 대화만 이어갑니다: "${message}". 워크플로우 결과는 그대로 유지했습니다.`,
      suggested_actions: ["체크박스를 다시 켜면 현재 종목으로 워크플로우를 재실행할 수 있습니다."],
      applied_to_workflow: false,
      updated_run_id: runId,
      updated_result: existingResult,
    });
    return;
  }

  const updatedResult = runWorkflow({
    symbols,
    max_position_weight: existingResult?.mandate?.max_position_weight ?? 0.2,
    mandate: existingResult?.mandate ?? null,
    user_prompt: existingResult?.user_prompt ?? "",
    chat_messages: chatMessages,
    prompt_overrides: {},
  });

  addWorkflowRun(updatedResult);

  const decisionSummary = updatedResult.decisions
    .map((d) => `${d.symbol}: ${d.action} (신뢰도 ${(d.confidence * 100).toFixed(0)}%)`)
    .join(", ");

  res.json({
    focus: "workflow_update",
    reply: `후속 요청이 반영되었습니다. 업데이트된 판단: ${decisionSummary || "없음"}`,
    suggested_actions: updatedResult.decisions
      .filter((d) => d.action !== "HOLD")
      .map((d) => `${d.symbol} ${d.action} 주문 검토`),
    applied_to_workflow: true,
    updated_run_id: updatedResult.run_id,
    updated_result: updatedResult,
  });
});

export default router;
