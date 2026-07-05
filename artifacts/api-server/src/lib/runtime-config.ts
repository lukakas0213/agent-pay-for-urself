const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_TIMEOUT_SECONDS = 30;

function readString(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function readBooleanEnv(name: string, fallback = false): boolean {
  const value = readString(name).toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function readNumberEnv(name: string, fallback: number): number {
  const raw = readString(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAppEnv(): string {
  return readString("APP_ENV") || process.env.NODE_ENV || "local";
}

export function getLogLevel(): string {
  return readString("LOG_LEVEL") || "info";
}

export function getMarketDataProviderName(): string {
  return readString("MARKET_DATA_PROVIDER").toLowerCase() || "yahoo";
}

export function getExperimentStorePath(): string {
  return readString("EXPERIMENT_STORE_PATH") || "data/experiments.json";
}

export function isExperimentLiveOrderEnabled(): boolean {
  return readBooleanEnv("EXPERIMENT_LIVE_ORDER_ENABLED", false);
}

export function getOpenAiDefaultModel(): string {
  return readString("OPENAI_MODEL") || DEFAULT_OPENAI_MODEL;
}

export function getOpenAiBaseUrl(): string {
  return readString("OPENAI_BASE_URL") || DEFAULT_OPENAI_BASE_URL;
}

export function getOpenAiTimeoutMs(): number {
  const explicitMs = readString("OPENAI_TIMEOUT_MS");
  if (explicitMs) {
    const parsed = Number(explicitMs);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const seconds = readNumberEnv("OPENAI_TIMEOUT_SECONDS", DEFAULT_OPENAI_TIMEOUT_SECONDS);
  return seconds > 0 ? seconds * 1000 : DEFAULT_OPENAI_TIMEOUT_SECONDS * 1000;
}

