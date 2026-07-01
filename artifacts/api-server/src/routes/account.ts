import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/account", (_req, res) => {
  res.json({
    available: false,
    broker: "한국투자증권",
    account_masked: null,
    summary: null,
    holdings: [],
    message: "브로커 연결 미설정. 환경 변수(KIS_APP_KEY, KIS_APP_SECRET, KIS_ACCOUNT_NO)를 구성하면 실계좌 데이터를 조회할 수 있습니다.",
  });
});

export default router;
