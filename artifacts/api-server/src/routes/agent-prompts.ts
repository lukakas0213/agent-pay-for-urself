import { Router, type IRouter } from "express";

const router: IRouter = Router();

type AgentKey = "data_collection" | "data_analysis" | "report" | "buy_sell" | "order_execution" | "log_evaluation";

const defaultPrompts: Record<AgentKey, { label: string; prompt: string }> = {
  data_collection: {
    label: "데이터 수집",
    prompt: "각 종목에 대해 최신 시세, 관련 뉴스 헤드라인, 그리고 주요 재무 지표(PER, 시가총액 등)를 수집하라. 수집한 데이터는 구조화된 JSON 형식으로 반환하라.",
  },
  data_analysis: {
    label: "데이터 분석",
    prompt: "수집된 시장 데이터를 기반으로 각 종목의 가격 모멘텀, 뉴스 감성, 재무 건전성을 0~1 점수로 평가하고 총점과 분석 근거를 제시하라.",
  },
  report: {
    label: "보고서 작성",
    prompt: "분석 시그널을 바탕으로 투자 보고서를 작성하라. 강세/약세 포인트, 리스크 플래그, 리스크 승인 여부, 최대 포지션 비중, 추천 액션 편향, 신호 강도를 포함하라.",
  },
  buy_sell: {
    label: "매수/매도 판단",
    prompt: "투자 보고서를 기반으로 각 종목에 대해 BUY/SELL/HOLD 결정을 내리고 자신감 점수(0~1)와 근거를 명확히 제시하라.",
  },
  order_execution: {
    label: "주문 실행",
    prompt: "매매 판단을 바탕으로 주문 계획을 수립하라. 수량, 지정가, 제출 가능 여부를 결정하고, 제출 불가 시 사유를 명확히 기재하라.",
  },
  log_evaluation: {
    label: "로그/평가",
    prompt: "전체 워크플로우 실행을 요약하라. 판단 수, 주문 수, 차단된 주문 수를 집계하고 다음 실행을 위한 확인 사항을 메모로 남겨라.",
  },
};

const userPrompts: Partial<Record<AgentKey, { prompt: string; updated_at: string }>> = {};

const agentKeys: AgentKey[] = ["data_collection", "data_analysis", "report", "buy_sell", "order_execution", "log_evaluation"];

router.get("/agent-prompts", (_req, res) => {
  const items = agentKeys.map((key) => {
    const user = userPrompts[key];
    const def = defaultPrompts[key];
    return {
      agent_key: key,
      label: def.label,
      prompt: user?.prompt ?? def.prompt,
      updated_at: user?.updated_at ?? new Date().toISOString(),
      source: user ? "user" : "default",
    };
  });
  res.json(items);
});

router.put("/agent-prompts/:agent_key", (req, res) => {
  const key = req.params.agent_key as AgentKey;
  if (!agentKeys.includes(key)) {
    res.status(404).json({ error: "에이전트 키를 찾을 수 없습니다." });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  userPrompts[key] = { prompt, updated_at: new Date().toISOString() };

  const def = defaultPrompts[key];
  res.json({
    item: {
      agent_key: key,
      label: def.label,
      prompt,
      updated_at: userPrompts[key]!.updated_at,
      source: "user",
    },
  });
});

export default router;
