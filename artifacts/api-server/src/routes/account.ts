import { Router, type IRouter } from "express";

const router: IRouter = Router();

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function maskAccountNumber(accountNumber: string) {
  if (!accountNumber) return null;
  if (accountNumber.length <= 4) return "*".repeat(accountNumber.length);
  return `${accountNumber.slice(0, 2)}${"*".repeat(accountNumber.length - 4)}${accountNumber.slice(-2)}`;
}

router.get("/account", (_req, res) => {
  const brokerAdapter = firstNonEmpty(process.env.BROKER_ADAPTER, "kis_mock");
  const appKey = firstNonEmpty(process.env.KIS_APP_KEY, process.env.KIS_MOCK_APP_KEY);
  const appSecret = firstNonEmpty(process.env.KIS_APP_SECRET, process.env.KIS_MOCK_APP_SECRET);
  const accountNumber = firstNonEmpty(process.env.KIS_ACCOUNT_NO, process.env.KIS_MOCK_ACCOUNT_NUMBER);
  const accountProductCode = firstNonEmpty(
    process.env.KIS_ACCOUNT_PRODUCT_CODE,
    process.env.KIS_MOCK_ACCOUNT_PRODUCT_CODE,
  );
  const broker = brokerAdapter === "kis_mock" ? "한국투자증권" : brokerAdapter;
  const isConfigured = Boolean(appKey && appSecret && accountNumber && accountProductCode);

  res.json({
    available: isConfigured,
    broker,
    account_masked: maskAccountNumber(accountNumber),
    summary: null,
    holdings: [],
    message: isConfigured
      ? `${broker} 계좌 설정을 확인했습니다. 현재 Express 서버에는 실계좌 조회 adapter가 아직 연결되지 않아 잔고와 보유 종목은 비어 있습니다.`
      : "브로커 연결 미설정. 환경 변수(KIS_APP_KEY 또는 KIS_MOCK_APP_KEY, KIS_APP_SECRET 또는 KIS_MOCK_APP_SECRET, KIS_ACCOUNT_NO 또는 KIS_MOCK_ACCOUNT_NUMBER)를 구성하면 계좌 상태를 확인할 수 있습니다.",
  });
});

export default router;
