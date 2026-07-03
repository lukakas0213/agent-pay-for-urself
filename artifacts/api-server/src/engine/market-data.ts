import type { MarketData } from "./schemas";

const DEFAULT_PRICE = 100.0;
const DEFAULT_PE_RATIO = 20.0;

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

export class StubMarketDataProvider {
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
