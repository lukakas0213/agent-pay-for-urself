import type { AgentKey } from "./agent-prompts-store";
import { logger } from "./logger";
import {
  getOpenAiBaseUrl,
  getOpenAiDefaultModel,
  getOpenAiTimeoutMs,
} from "./runtime-config";

export type LlmMode = "model" | "fallback";

type OpenAiRuntime = {
  llm_mode: LlmMode;
  model_name: string | null;
  agent_models: Record<string, string> | null;
  enabled: boolean;
  api_key: string | null;
  base_url: string;
  organization: string | null;
  timeout_ms: number;
};

const AGENT_MODEL_ENV_KEYS: Record<string, string> = {
  main_agent: "OPENAI_MAIN_AGENT_MODEL",
  data_collection: "OPENAI_DATA_COLLECTION_MODEL",
  data_analysis: "OPENAI_DATA_ANALYSIS_MODEL",
  report: "OPENAI_REPORT_MODEL",
  buy_sell: "OPENAI_BUY_SELL_MODEL",
  risk_management: "OPENAI_RISK_MANAGEMENT_MODEL",
  order_execution: "OPENAI_ORDER_EXECUTION_MODEL",
  log_evaluation: "OPENAI_LOG_EVALUATION_MODEL",
  feedback: "OPENAI_FEEDBACK_MODEL",
};

const DEFAULT_MODEL = getOpenAiDefaultModel();
const DEFAULT_BASE_URL = getOpenAiBaseUrl();
const DEFAULT_TIMEOUT_MS = getOpenAiTimeoutMs();

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildAgentModels(): Record<string, string> {
  return {
    main_agent: process.env.OPENAI_MAIN_AGENT_MODEL?.trim() || DEFAULT_MODEL,
    data_collection: process.env.OPENAI_DATA_COLLECTION_MODEL?.trim() || DEFAULT_MODEL,
    data_analysis: process.env.OPENAI_DATA_ANALYSIS_MODEL?.trim() || DEFAULT_MODEL,
    report: process.env.OPENAI_REPORT_MODEL?.trim() || DEFAULT_MODEL,
    buy_sell: process.env.OPENAI_BUY_SELL_MODEL?.trim() || DEFAULT_MODEL,
    risk_management: process.env.OPENAI_RISK_MANAGEMENT_MODEL?.trim() || DEFAULT_MODEL,
    order_execution: process.env.OPENAI_ORDER_EXECUTION_MODEL?.trim() || DEFAULT_MODEL,
    log_evaluation: process.env.OPENAI_LOG_EVALUATION_MODEL?.trim() || DEFAULT_MODEL,
    feedback: process.env.OPENAI_FEEDBACK_MODEL?.trim() || DEFAULT_MODEL,
  };
}

function buildOpenAiRuntime(): OpenAiRuntime {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const organization = process.env.OPENAI_ORG_ID?.trim() || null;
  const enabled = Boolean(apiKey);

  return {
    llm_mode: enabled ? "model" : "fallback",
    model_name: enabled ? DEFAULT_MODEL : null,
    agent_models: enabled ? buildAgentModels() : null,
    enabled,
    api_key: apiKey,
    base_url: normalizeBaseUrl(DEFAULT_BASE_URL),
    organization,
    timeout_ms: Number.isFinite(DEFAULT_TIMEOUT_MS) && DEFAULT_TIMEOUT_MS > 0 ? DEFAULT_TIMEOUT_MS : 15000,
  };
}

const runtime = buildOpenAiRuntime();

export function getOpenAiRuntimeSummary(): Pick<
  OpenAiRuntime,
  "llm_mode" | "model_name" | "agent_models"
> {
  return {
    llm_mode: runtime.llm_mode,
    model_name: runtime.model_name,
    agent_models: runtime.agent_models,
  };
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return trimmed;
}

function extractJsonPayload(text: string): string {
  const stripped = stripCodeFences(text);
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }
  const firstBracket = stripped.indexOf("[");
  const lastBracket = stripped.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return stripped.slice(firstBracket, lastBracket + 1);
  }
  return stripped;
}

function getAgentModel(agentKey: AgentKey): string | null {
  if (!runtime.enabled || !runtime.agent_models || !runtime.model_name) {
    return null;
  }

  const candidate = runtime.agent_models[agentKey] || process.env[AGENT_MODEL_ENV_KEYS[agentKey]]?.trim();
  return candidate && candidate.length > 0 ? candidate : runtime.model_name;
}

export async function invokeJsonCompletion<T>({
  agentKey,
  systemPrompt,
  userPayload,
}: {
  agentKey: AgentKey;
  systemPrompt: string;
  userPayload: unknown;
}): Promise<T | null> {
  const model = getAgentModel(agentKey);
  if (!runtime.enabled || !runtime.api_key || !model) {
    return null;
  }

  try {
    const response = await fetch(`${runtime.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.api_key}`,
        "Content-Type": "application/json",
        ...(runtime.organization ? { "OpenAI-Organization": runtime.organization } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `${systemPrompt}\n\n` +
              "Return only valid JSON. Do not wrap the response in markdown fences.",
          },
          {
            role: "user",
            content: JSON.stringify(userPayload, null, 2),
          },
        ],
      }),
      signal: AbortSignal.timeout(runtime.timeout_ms),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed with ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? null;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenAI response did not include message content");
    }

    const parsed = JSON.parse(extractJsonPayload(content)) as T;
    return parsed;
  } catch (error) {
    logger.warn(
      { err: error, agentKey, model },
      "OpenAI request failed, falling back to deterministic agent logic",
    );
    return null;
  }
}

export async function invokeTextCompletion({
  agentKey,
  systemPrompt,
  userPayload,
}: {
  agentKey: AgentKey;
  systemPrompt: string;
  userPayload: unknown;
}): Promise<string | null> {
  const model = getAgentModel(agentKey);
  if (!runtime.enabled || !runtime.api_key || !model) {
    return null;
  }

  try {
    const response = await fetch(runtime.base_url + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + runtime.api_key,
        "Content-Type": "application/json",
        ...(runtime.organization ? { "OpenAI-Organization": runtime.organization } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify(userPayload, null, 2),
          },
        ],
      }),
      signal: AbortSignal.timeout(runtime.timeout_ms),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error("OpenAI request failed with " + response.status + ": " + errorText);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>; 
    };
    const content = data.choices?.[0]?.message?.content ?? null;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenAI response did not include message content");
    }

    return content.trim();
  } catch (error) {
    logger.warn(
      { err: error, agentKey, model },
      "OpenAI request failed, falling back to deterministic agent logic",
    );
    return null;
  }
}
