export type AgentKey =
  | "data_collection"
  | "data_analysis"
  | "report"
  | "buy_sell"
  | "feedback";

export interface AgentPromptDefinition {
  label: string;
  prompt: string;
}

const defaultPrompts: Record<AgentKey, AgentPromptDefinition> = {
  data_collection: {
    label: "데이터 수집 에이전트",
    prompt:
      "각 종목에 대해 최신 시세, 관련 뉴스 헤드라인, 주요 재무 지표를 수집하라. 누락된 데이터가 있으면 명시하라.",
  },
  data_analysis: {
    label: "데이터 분석 에이전트",
    prompt:
      "수집된 시장 데이터를 기반으로 각 종목의 가격 모멘텀, 뉴스 감성, 재무 건전성을 0~1 점수로 평가하고 총점과 분석 근거를 제시하라.",
  },
  report: {
    label: "보고서 에이전트",
    prompt:
      "분석 시그널을 바탕으로 투자 보고서를 작성하라. 강세/약세 포인트, 리스크 플래그, 최대 포지션 비중, 추천 액션 편향, 신호 강도를 포함하라.",
  },
  buy_sell: {
    label: "매수/매도 에이전트",
    prompt:
      "투자 보고서를 기반으로 각 종목에 대해 BUY/SELL/HOLD 결정을 내리고 자신감 점수(0~1)와 근거를 명확히 제시하라.",
  },
  feedback: {
    label: "피드백 에이전트",
    prompt:
      "전체 시스템을 관찰하고 데이터 수집, 데이터 분석, 보고서, 매수/매도 단계에 대한 피드백을 작성하라. 다음 실행에서 재수집 또는 재분석이 필요한 지점을 구체적으로 제안하라.",
  },
};

const userPrompts: Partial<Record<AgentKey, { prompt: string; updated_at: string }>> = {};

export const agentKeys: AgentKey[] = [
  "data_collection",
  "data_analysis",
  "report",
  "buy_sell",
  "feedback",
];

export function getPromptCatalog(): Record<AgentKey, AgentPromptDefinition> {
  return defaultPrompts;
}

export function getStoredPrompt(key: AgentKey): { prompt: string; updated_at: string } | undefined {
  return userPrompts[key];
}

export function setStoredPrompt(key: AgentKey, prompt: string): { prompt: string; updated_at: string } {
  const item = { prompt, updated_at: new Date().toISOString() };
  userPrompts[key] = item;
  return item;
}

export function resolveAgentPrompts(
  overrides: Partial<Record<AgentKey, string>> = {},
): Record<AgentKey, string> {
  const resolved = {} as Record<AgentKey, string>;
  for (const key of agentKeys) {
    resolved[key] = overrides[key] ?? userPrompts[key]?.prompt ?? defaultPrompts[key].prompt;
  }
  return resolved;
}
