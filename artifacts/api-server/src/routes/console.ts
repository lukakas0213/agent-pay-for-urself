import { Router, type IRouter } from "express";
import { runWorkflow } from "../engine/orchestrator";
import type { WorkflowResult } from "../engine/schemas";
import { addWorkflowRun, getWorkflowRun } from "../lib/history-store";
import { saveWorkflowResultAsExperiment } from "../lib/experiment-store";
import { resolveAgentPrompts } from "../lib/agent-prompts-store";
import { invokeJsonCompletion } from "../lib/openai";

const router: IRouter = Router();

type MainAgentReply = {
  focus: string;
  reply: string;
  suggested_actions: string[];
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toRiskTolerance(value: unknown) {
  return value === "low" || value === "high" ? value : "medium";
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function extractSymbolsFromText(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}\b/g) ?? [];
  const stopWords = new Set(["BUY", "SELL", "HOLD", "LONG", "SHORT"]);
  return Array.from(new Set(matches.filter((symbol) => !stopWords.has(symbol))));
}

function summarizeResult(result: WorkflowResult | null) {
  if (!result) return null;
  return {
    run_id: result.run_id,
    symbols: result.symbols,
    objective: result.supervisor_directive.objective || result.user_prompt,
    summary: result.supervisor_directive.summary || result.feedback.summary,
    decisions: result.decisions.map((decision) => ({
      symbol: decision.symbol,
      action: decision.action,
      confidence: decision.confidence,
      rationale: decision.rationale,
    })),
    latest_messages: result.chat_messages.slice(-6),
  };
}

function buildFallbackReply({
  message,
  symbols,
  existingResult,
  updatedResult,
}: {
  message: string;
  symbols: string[];
  existingResult: WorkflowResult | null;
  updatedResult: WorkflowResult | null;
}): MainAgentReply {
  if (updatedResult) {
    const decisionSummary = updatedResult.decisions.length
      ? updatedResult.decisions
          .map((decision) => `${decision.symbol} ${decision.action} (${Math.round(decision.confidence * 100)}%)`)
          .join(", ")
      : "판단 없음";

    return {
      focus: "workflow_update",
      reply: `요청을 반영해 워크플로우를 갱신했습니다. 핵심 판단: ${decisionSummary}.`,
      suggested_actions: updatedResult.decisions
        .filter((decision) => decision.action !== "HOLD")
        .map((decision) => `${decision.symbol} ${decision.action} 검토`),
    };
  }

  if (existingResult) {
    const decisionSummary = existingResult.decisions.length
      ? existingResult.decisions.map((decision) => `${decision.symbol} ${decision.action}`).join(", ")
      : "현재 판단 없음";
    return {
      focus: "conversation",
      reply: `현재 실행 기준으로 답하면, ${decisionSummary} 입니다. 질문을 조금 더 좁히면 바로 이어서 답할 수 있습니다.`,
      suggested_actions: symbols.length > 0
        ? [`${symbols.join(", ")} 기준으로 추가 분석 요청하기`]
        : ["종목 티커나 목표를 포함해 다시 질문하기"],
    };
  }

  const targetText = symbols.length > 0 ? `${symbols.join(", ")} 관련` : "현재 정보 기준";
  return {
    focus: "conversation",
    reply: `${targetText}으로 대화를 시작했습니다. ${message ? "질문을 조금 더 구체화하면" : "원하시는 방향을 알려주시면"} 바로 정리해드리겠습니다.`,
    suggested_actions: symbols.length > 0
      ? [`${symbols.join(", ")}를 더 깊게 분석해 달라고 요청하기`]
      : ["관심 종목과 목표를 함께 알려주기"],
  };
}

async function generateMainAgentReply({
  message,
  symbols,
  existingResult,
  updatedResult,
  appliedToWorkflow,
}: {
  message: string;
  symbols: string[];
  existingResult: WorkflowResult | null;
  updatedResult: WorkflowResult | null;
  appliedToWorkflow: boolean;
}): Promise<MainAgentReply> {
  const prompts = resolveAgentPrompts();
  const modelReply = await invokeJsonCompletion<Partial<MainAgentReply>>({
    agentKey: "main_agent",
    systemPrompt: [
      "You are the main agent for a stock workflow chat console.",
      prompts.main_agent,
      "Answer in Korean and keep the tone conversational, like ChatGPT.",
      "If the user has not provided enough context, ask one focused follow-up question.",
      "When workflow output is present, summarize the answer around the active result instead of repeating raw JSON fields.",
      "Return JSON with focus, reply, and suggested_actions.",
    ].join("\n"),
    userPayload: {
      message,
      symbols,
      applied_to_workflow: appliedToWorkflow,
      current_result: summarizeResult(existingResult),
      updated_result: summarizeResult(updatedResult),
    },
  });

  if (!modelReply) {
    return buildFallbackReply({ message, symbols, existingResult, updatedResult });
  }

  const reply = String(modelReply.reply ?? "").trim();
  const focus = String(modelReply.focus ?? "").trim() || (updatedResult ? "workflow_update" : existingResult ? "conversation" : "conversation");
  const suggestedActions = toStringArray(modelReply.suggested_actions);

  if (!reply) {
    return buildFallbackReply({ message, symbols, existingResult, updatedResult });
  }

  const fallbackActions = buildFallbackReply({ message, symbols, existingResult, updatedResult }).suggested_actions;
  return {
    focus,
    reply,
    suggested_actions: suggestedActions.length > 0 ? suggestedActions : fallbackActions,
  };
}

async function handleInteraction(req: any, res: any) {
  const body = req.body as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const runId = typeof body.run_id === "string" ? body.run_id : null;
  const storedResult = runId ? getWorkflowRun(runId) ?? null : null;

  const currentResult = storedResult ??
    (body.current_result && typeof body.current_result === "object"
      ? (body.current_result as WorkflowResult)
      : null);

  if (runId && !storedResult && !currentResult) {
    res.status(404).json({ error: `workflow run not found: ${runId}` });
    return;
  }
  const applyToWorkflow = typeof body.apply_to_workflow === "boolean" ? body.apply_to_workflow : true;
  const bodySymbols = Array.isArray(body.symbols)
    ? body.symbols.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
    : [];
  const extractedSymbols = extractSymbolsFromText(message);
  const symbols = currentResult?.symbols?.length ? currentResult.symbols : Array.from(new Set([...bodySymbols, ...extractedSymbols]));
  const currentUserPrompt = currentResult?.user_prompt?.trim() || message;
  const workflowMaxPositionWeight = currentResult?.mandate?.max_position_weight ?? toNumber(body.max_position_weight, 0.2);
  const workflowRiskTolerance = currentResult?.mandate?.risk_tolerance ?? toRiskTolerance(body.risk_tolerance);
  const workflowAutoTradingEnabled = currentResult?.mandate?.requires_approval_for_live_orders !== undefined
    ? !currentResult.mandate.requires_approval_for_live_orders
    : toBoolean(body.auto_trading_enabled, false);
  const chatMessages = currentResult?.chat_messages
    ? [...currentResult.chat_messages, message]
    : [message];

  if (!message) {
    res.status(422).json({ error: "message 필드가 필요합니다." });
    return;
  }

  if (applyToWorkflow && symbols.length > 0) {
    const updatedResult = await runWorkflow({
      symbols,
      max_position_weight: workflowMaxPositionWeight,
      mandate: {
        objective: currentUserPrompt,
        allowed_symbols: currentResult?.mandate?.allowed_symbols ?? [],
        excluded_symbols: currentResult?.mandate?.excluded_symbols ?? [],
        max_position_weight: workflowMaxPositionWeight,
        max_order_notional: currentResult?.mandate?.max_order_notional ?? null,
        min_cash_weight: currentResult?.mandate?.min_cash_weight ?? null,
        risk_tolerance: workflowRiskTolerance,
        requires_approval_for_live_orders: !workflowAutoTradingEnabled,
        user_notes: currentResult?.mandate?.user_notes ?? "",
      },
      user_prompt: currentUserPrompt,
      chat_messages: chatMessages,
      prompt_overrides: {},
    });

    addWorkflowRun(updatedResult);
    try {
      saveWorkflowResultAsExperiment(updatedResult);
    } catch (error) {
      console.warn("failed to auto-save workflow experiment", error);
    }

    const reply = await generateMainAgentReply({
      message,
      symbols,
      existingResult: currentResult,
      updatedResult,
      appliedToWorkflow: true,
    });

    res.json({
      focus: reply.focus,
      reply: reply.reply,
      suggested_actions: reply.suggested_actions,
      applied_to_workflow: true,
      updated_run_id: updatedResult.run_id,
      updated_result: updatedResult,
    });
    return;
  }

  const reply = await generateMainAgentReply({
    message,
    symbols,
    existingResult: currentResult,
    updatedResult: null,
    appliedToWorkflow: false,
  });

  res.json({
    focus: reply.focus,
    reply: reply.reply,
    suggested_actions: reply.suggested_actions,
    applied_to_workflow: false,
    updated_run_id: runId,
    updated_result: currentResult,
  });
}

router.post("/console/interactions", async (req, res) => {
  await handleInteraction(req, res);
});

router.post("/agent/interactions", async (req, res) => {
  await handleInteraction(req, res);
});

export default router;
