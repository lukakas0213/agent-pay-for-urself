import { Router, type IRouter } from "express";
import { buildKisMockBrokerConfig, getBrokerAdapterName } from "../lib/broker-config";

const router: IRouter = Router();

function maskAccountNumber(accountNumber: string) {
  if (!accountNumber) return null;
  if (accountNumber.length <= 4) return "*".repeat(accountNumber.length);
  return `${accountNumber.slice(0, 2)}${"*".repeat(accountNumber.length - 4)}${accountNumber.slice(-2)}`;
}

router.get("/account", (_req, res) => {
  const brokerAdapter = getBrokerAdapterName() || "kis_mock";
  const config = buildKisMockBrokerConfig();
  const broker = brokerAdapter === "kis_mock" ? "한국투자증권" : brokerAdapter;
  const isConfigured = Boolean(
    config.app_key && config.app_secret && config.account_number && config.account_product_code,
  );

  res.json({
    available: isConfigured,
    broker,
    account_masked: maskAccountNumber(config.account_number),
    summary: null,
    holdings: [],
    message: isConfigured
      ? `${broker} 계좌 설정을 확인했습니다. 현재 Express 서버에는 실계좌 조회 adapter가 아직 연결되지 않아 잔고와 보유 종목은 비어 있습니다.`
      : "브로커 연결 미설정. 환경 변수(KIS_APP_KEY 또는 KIS_MOCK_APP_KEY, KIS_APP_SECRET 또는 KIS_MOCK_APP_SECRET, KIS_ACCOUNT_NO 또는 KIS_MOCK_ACCOUNT_NUMBER)를 구성하면 계좌 상태를 확인할 수 있습니다.",
  });
});

export default router;
