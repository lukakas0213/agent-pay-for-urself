import { getMarketDataProviderName } from "../lib/runtime-config";
import type { MarketData } from "./schemas";

const DEFAULT_PRICE = 100.0;
const DEFAULT_PE_RATIO = 20.0;
const DEFAULT_YAHOO_NEWS_COUNT = 3;
const DEFAULT_YAHOO_HISTORY_PERIOD = "5d";
const DEFAULT_TIMEOUT_MS = 5000;

const STUB_PRICES: Record<string, number> = {
  AAPL: 189.5,
  MSFT: 415.2,
  TSLA: 242.8,
  NVDA: 875.4,
  AMZN: 185.1,
  GOOGL: 175.3,
  META: 498.7,
  NFLX: 635.2,
  "005930": 71200,
  "035420": 198000,
};

const STUB_PE: Record<string, number> = {
  AAPL: 28.5,
  MSFT: 34.2,
  TSLA: 65.1,
  NVDA: 42.8,
  AMZN: 38.4,
  GOOGL: 22.7,
  META: 25.3,
  NFLX: 45.6,
  "005930": 12.4,
  "035420": 32.1,
};

const STUB_NEWS: Record<string, string[]> = {
  AAPL: ["애플, 신형 AI 기능 탑재 아이폰 출시 예정", "애플 실적 발표 예상치 상회"],
  MSFT: ["마이크로소프트, Azure AI 수요 급증", "코파일럿 기업 도입 확대 보고"],
  TSLA: ["테슬라, 2분기 인도량 기대 이하", "테슬라 오토파일럿 규제 불확실성"],
  NVDA: ["엔비디아 데이터센터 GPU 수요 역대 최고", "블랙웰 아키텍처 출하 호조"],
  AMZN: ["아마존 AWS 클라우드 점유율 유지", "아마존 광고 매출 견조한 성장세"],
  GOOGL: ["구글 검색 AI 통합 가속화", "유튜브 광고 수익 개선"],
  META: ["메타 AI 어시스턴트 이용자 급증", "광고 단가 회복세 지속"],
};

const YAHOO_FINANCE_SYMBOL_OVERRIDES: Record<string, string> = {
  "005930": "005930.KS",
  "035420": "035420.KS",
};

const YAHOO_TO_KIS_ORDER_EXCHANGE_CODE: Record<string, string> = {
  nasdaq: "NASD",
  nasdaqcm: "NASD",
  nasdaqgm: "NASD",
  nasdaqgs: "NASD",
  nms: "NASD",
  nas: "NASD",
  nyse: "NYSE",
  newyorkstockexchange: "NYSE",
  nyq: "NYSE",
  nys: "NYSE",
  nyseamerican: "AMEX",
  nysemkt: "AMEX",
  amex: "AMEX",
  americanstockexchange: "AMEX",
  ase: "AMEX",
  ams: "AMEX",
  kospi: "005930",
  kosdaq: "035420",
};

export function normalizeYahooFinanceSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return normalized;
  if (normalized.endsWith(".KS") || normalized.endsWith(".KQ")) return normalized;
  return YAHOO_FINANCE_SYMBOL_OVERRIDES[normalized] ?? normalized;
}

function normalizeExchangeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return collapsed || null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractNewsTitle(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const title = record.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const content = record.content;
  if (content && typeof content === "object") {
    const nested = (content as Record<string, unknown>).title;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

class YahooFinanceMarketDataProvider {
  readonly mode_name = "yahoo";

  async getMarketData(symbol: string): Promise<MarketData> {
    const normalizedSymbol = normalizeYahooFinanceSymbol(symbol);
    const [quotePayload, newsPayload] = await Promise.all([
      this.fetchQuote(normalizedSymbol),
      this.fetchNews(normalizedSymbol),
    ]);

    const quote = quotePayload?.quoteResponse?.result?.[0] ?? null;
    const latestPrice =
      coerceNumber(quote?.regularMarketPrice) ??
      coerceNumber(quote?.postMarketPrice) ??
      coerceNumber(quote?.preMarketPrice) ??
      DEFAULT_PRICE;

    const peRatio =
      coerceNumber(quote?.trailingPE) ?? coerceNumber(quote?.forwardPE) ?? DEFAULT_PE_RATIO;

    const exchangeSource = quote?.fullExchangeName ?? quote?.exchange ?? quote?.marketState;
    const normalizedExchange = normalizeExchangeName(exchangeSource);
    const brokerExchangeCode =
      normalizedExchange !== null ? YAHOO_TO_KIS_ORDER_EXCHANGE_CODE[normalizedExchange] ?? null : null;

    const newsHeadlines = this.extractHeadlines(newsPayload);

    return {
      symbol: symbol.trim().toUpperCase(),
      latest_price: latestPrice,
      broker_exchange_code: brokerExchangeCode,
      news_headlines: newsHeadlines,
      financial_metrics: { pe_ratio: peRatio },
    };
  }

  private async fetchQuote(symbol: string): Promise<YahooQuoteResponse | null> {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    return fetchJson<YahooQuoteResponse>(url);
  }

  private async fetchNews(symbol: string): Promise<YahooNewsResponse | null> {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=${DEFAULT_YAHOO_NEWS_COUNT}`;
    return fetchJson<YahooNewsResponse>(url);
  }

  private extractHeadlines(payload: YahooNewsResponse | null): string[] {
    const newsItems = payload?.news ?? [];
    const headlines: string[] = [];
    for (const item of newsItems) {
      const title = extractNewsTitle(item);
      if (title) {
        headlines.push(title);
      }
      if (headlines.length >= DEFAULT_YAHOO_NEWS_COUNT) {
        break;
      }
    }
    return headlines;
  }
}

class StubMarketDataProvider {
  readonly mode_name = "stub";

  getMarketData(symbol: string): MarketData {
    const upper = symbol.toUpperCase();
    return {
      symbol: upper,
      latest_price: STUB_PRICES[upper] ?? DEFAULT_PRICE,
      broker_exchange_code: null,
      news_headlines: STUB_NEWS[upper] ?? [`${upper} market update`],
      financial_metrics: { pe_ratio: STUB_PE[upper] ?? DEFAULT_PE_RATIO },
    };
  }
}

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: Array<{
      regularMarketPrice?: number | string;
      postMarketPrice?: number | string;
      preMarketPrice?: number | string;
      trailingPE?: number | string;
      forwardPE?: number | string;
      exchange?: string;
      fullExchangeName?: string;
      marketState?: string;
    }>;
  };
};

type YahooNewsResponse = {
  news?: Array<Record<string, unknown>>;
};

export type MarketDataProvider = StubMarketDataProvider | YahooFinanceMarketDataProvider;

export function buildMarketDataProvider(): MarketDataProvider {
  const providerName = getMarketDataProviderName();
  if (providerName === "yahoo" || providerName === "yfinance") {
    return new YahooFinanceMarketDataProvider();
  }
  return new StubMarketDataProvider();
}

export { StubMarketDataProvider, YahooFinanceMarketDataProvider };
