import { readBooleanEnv, readNumberEnv } from "./runtime-config";

function readString(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

export type BrokerAdapterName = "noop" | "kis_mock" | string;

export interface KisMockBrokerConfig {
  app_key: string;
  app_secret: string;
  account_number: string;
  account_product_code: string;
  base_url: string;
  contact_phone: string;
  management_order_number: string;
  order_server_division_code: string;
  order_division_code: string;
  timeout_seconds: number;
}

export function getBrokerAdapterName(): BrokerAdapterName {
  return firstNonEmpty(process.env.BROKER_ADAPTER) || "noop";
}

export function buildKisMockBrokerConfig(): KisMockBrokerConfig {
  const appKey = firstNonEmpty(process.env.KIS_APP_KEY, process.env.KIS_MOCK_APP_KEY, process.env.BROKER_API_KEY);
  const appSecret = firstNonEmpty(process.env.KIS_APP_SECRET, process.env.KIS_MOCK_APP_SECRET);
  const accountNumber = firstNonEmpty(process.env.KIS_ACCOUNT_NO, process.env.KIS_MOCK_ACCOUNT_NUMBER);
  const accountProductCode = firstNonEmpty(process.env.KIS_ACCOUNT_PRODUCT_CODE, process.env.KIS_MOCK_ACCOUNT_PRODUCT_CODE) || "01";

  return {
    app_key: appKey,
    app_secret: appSecret,
    account_number: accountNumber,
    account_product_code: accountProductCode,
    base_url: firstNonEmpty(process.env.KIS_MOCK_BASE_URL) || "https://openapivts.koreainvestment.com:29443",
    contact_phone: firstNonEmpty(process.env.KIS_MOCK_CONTACT_PHONE),
    management_order_number: firstNonEmpty(process.env.KIS_MOCK_MANAGEMENT_ORDER_NUMBER),
    order_server_division_code: firstNonEmpty(process.env.KIS_MOCK_ORDER_SERVER_DIVISION_CODE) || "0",
    order_division_code: firstNonEmpty(process.env.KIS_MOCK_ORDER_DIVISION_CODE) || "00",
    timeout_seconds: readNumberEnv("KIS_MOCK_TIMEOUT_SECONDS", 10),
  };
}

export function supportsLiveBrokerSubmission(): boolean {
  if (getBrokerAdapterName().toLowerCase() !== "kis_mock") {
    return false;
  }
  const config = buildKisMockBrokerConfig();
  return Boolean(config.app_key && config.app_secret && config.account_number && config.account_product_code);
}

export function isExperimentLiveOrderEnabledFlag(): boolean {
  return readBooleanEnv("EXPERIMENT_LIVE_ORDER_ENABLED", false);
}
