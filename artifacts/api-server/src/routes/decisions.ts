import { Router, type IRouter } from "express";
import { runWorkflow } from "../engine/orchestrator";
import type { InvestmentMandate, RiskTolerance } from "../engine/schemas";

const router: IRouter = Router();

router.post("/decisions", (req, res) => {
  const body = req.body as Record<string, unknown>;

  const symbols: string[] = Array.isArray(body.symbols)
    ? (body.symbols as unknown[]).map(String).filter(Boolean)
    : [];

  const maxPositionWeight =
    typeof body.max_position_weight === "number" ? body.max_position_weight : 0.2;

  const userPrompt = typeof body.user_prompt === "string" ? body.user_prompt : "";
  const chatMessages: string[] = Array.isArray(body.chat_messages)
    ? (body.chat_messages as unknown[]).map(String)
    : [];

  let mandate: InvestmentMandate | null = null;
  if (body.mandate && typeof body.mandate === "object") {
    const m = body.mandate as Record<string, unknown>;
    mandate = {
      objective:
        typeof m.objective === "string"
          ? m.objective
          : userPrompt || "Evaluate requested equity symbols conservatively.",
      allowed_symbols: Array.isArray(m.allowed_symbols)
        ? (m.allowed_symbols as unknown[]).map(String)
        : [],
      excluded_symbols: Array.isArray(m.excluded_symbols)
        ? (m.excluded_symbols as unknown[]).map(String)
        : [],
      max_position_weight:
        typeof m.max_position_weight === "number" ? m.max_position_weight : maxPositionWeight,
      max_order_notional:
        typeof m.max_order_notional === "number" ? m.max_order_notional : null,
      min_cash_weight:
        typeof m.min_cash_weight === "number" ? m.min_cash_weight : null,
      risk_tolerance:
        typeof m.risk_tolerance === "string"
          ? (m.risk_tolerance as RiskTolerance)
          : "medium",
      requires_approval_for_live_orders:
        typeof m.requires_approval_for_live_orders === "boolean"
          ? m.requires_approval_for_live_orders
          : true,
      user_notes: typeof m.user_notes === "string" ? m.user_notes : "",
    };
  }

  const promptOverrides: Record<string, string> = {};
  if (body.prompt_overrides && typeof body.prompt_overrides === "object") {
    const overrides = body.prompt_overrides as Record<string, unknown>;
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === "string") promptOverrides[k] = v;
    }
  }

  if (symbols.length === 0 && !userPrompt.trim()) {
    res.status(422).json({ error: "symbols 또는 user_prompt 중 하나 이상을 입력하세요." });
    return;
  }

  const result = runWorkflow({
    symbols,
    max_position_weight: maxPositionWeight,
    mandate,
    user_prompt: userPrompt,
    chat_messages: chatMessages,
    prompt_overrides: promptOverrides,
  });

  res.json(result);
});

export default router;
