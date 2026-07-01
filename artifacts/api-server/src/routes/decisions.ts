import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/decisions", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const symbols: string[] = Array.isArray(body.symbols) ? (body.symbols as string[]) : [];
  const userPrompt = typeof body.user_prompt === "string" ? body.user_prompt : "";

  const runId = `run-${Date.now()}`;

  res.json({
    run_id: runId,
    symbols,
    user_prompt: userPrompt,
    chat_messages: Array.isArray(body.chat_messages) ? body.chat_messages : [],
    runtime: {
      data_mode: "mock",
      llm_mode: "stub",
      model_name: null,
      agent_models: null,
      live_order_enabled: false,
    },
    mandate: body.mandate ?? {
      objective: userPrompt,
      allowed_symbols: [],
      excluded_symbols: [],
      max_position_weight: 0.2,
      max_order_notional: null,
      min_cash_weight: null,
      risk_tolerance: "medium",
      requires_approval_for_live_orders: true,
      user_notes: "",
    },
    supervisor_directive: {
      objective: userPrompt,
      focus_symbols: symbols,
      watch_symbols: [],
      guidance: ["백엔드 AI 연동 전 목 응답입니다."],
      summary: `${symbols.join(", ")} 종목에 대한 분석을 준비 중입니다. 실제 AI 백엔드 연동 후 결과가 채워집니다.`,
    },
    market_data: symbols.map((symbol) => ({
      symbol,
      latest_price: 100.0,
      broker_exchange_code: null,
      news_headlines: ["백엔드 연동 후 실제 뉴스가 표시됩니다."],
      financial_metrics: { pe_ratio: 20.0, market_cap: 1e9 },
    })),
    analysis_signals: symbols.map((symbol) => ({
      symbol,
      price_score: 0.5,
      news_score: 0.5,
      financial_score: 0.5,
      total_score: 0.5,
      rationale: "목 분석: 실제 AI 백엔드 연동 후 근거가 채워집니다.",
    })),
    investment_reports: symbols.map((symbol) => ({
      symbol,
      summary: `${symbol} 종목 목 보고서. 실제 AI 백엔드 연동 후 내용이 채워집니다.`,
      bull_points: ["AI 백엔드 연동 후 강세 포인트가 추가됩니다."],
      bear_points: ["AI 백엔드 연동 후 약세 포인트가 추가됩니다."],
      risk_flags: [],
      risk_approved: true,
      max_position_weight: 0.2,
      recommended_action_bias: "HOLD",
      signal_strength: 0.5,
      rationale: "목 보고서 근거.",
    })),
    decisions: symbols.map((symbol) => ({
      symbol,
      action: "HOLD",
      confidence: 0.5,
      rationale: "목 판단: AI 백엔드 연동 후 실제 판단이 채워집니다.",
      risk_approved: true,
    })),
    orders: symbols.map((symbol) => ({
      symbol,
      action: "HOLD",
      quantity: 0,
      broker_exchange_code: null,
      limit_price: null,
      should_submit: false,
      reason: "목 주문 계획: 자동매매 미연동.",
    })),
    evaluation_log: {
      decision_count: symbols.length,
      order_count: 0,
      blocked_order_count: symbols.length,
      notes: ["백엔드 AI 미연동 상태입니다. 목 응답이 반환됩니다."],
    },
    mandate_violations: [],
  });
});

export default router;
