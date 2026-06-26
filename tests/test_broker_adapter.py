from urllib.parse import urlsplit

from agent_pay_for_urself.adapters import KisMockBrokerAdapter, KisMockBrokerConfig
from agent_pay_for_urself.schemas import OrderPlan


class RecordingSender:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def __call__(self, *, method, url, headers, payload, timeout_seconds):
        self.calls.append(
            {
                "method": method,
                "url": url,
                "headers": headers,
                "payload": payload,
                "timeout_seconds": timeout_seconds,
            }
        )
        request_path = urlsplit(url).path
        if request_path.endswith("/oauth2/tokenP"):
            return __import__(
                "agent_pay_for_urself.adapters.kis_broker", fromlist=["KisHttpResponse"]
            ).KisHttpResponse(
                status_code=200,
                payload={
                    "access_token": "mock-token",
                    "access_token_token_expired": "2099-12-31 23:59:59",
                },
            )
        if request_path.endswith("/uapi/domestic-stock/v1/trading/inquire-balance"):
            return __import__(
                "agent_pay_for_urself.adapters.kis_broker", fromlist=["KisHttpResponse"]
            ).KisHttpResponse(
                status_code=200,
                payload={
                    "rt_cd": "0",
                    "msg1": "ok",
                    "output2": {
                        "dnca_tot_amt": "100000",
                        "pchs_amt_smtl_amt": "100000",
                        "tot_evlu_amt": "125000",
                        "evlu_pfls_smtl_amt": "25000",
                        "evlu_pfls_smtl_rt": "25.0",
                    },
                    "output1": [
                        {
                            "pdno": "AAPL",
                            "prdt_name": "Apple",
                            "hldg_qty": "2",
                            "pchs_avg_pric": "50000",
                            "prpr": "62500",
                            "evlu_amt": "125000",
                            "evlu_pfls_amt": "25000",
                            "evlu_pfls_rt": "25.0",
                        }
                    ],
                },
            )
        return __import__(
            "agent_pay_for_urself.adapters.kis_broker", fromlist=["KisHttpResponse"]
        ).KisHttpResponse(
            status_code=200,
            payload={"rt_cd": "0", "msg1": "submitted", "output": {"ODNO": "A0001"}},
        )


def test_kis_mock_broker_submits_order_when_config_and_metadata_are_present() -> None:
    sender = RecordingSender()
    adapter = KisMockBrokerAdapter(
        KisMockBrokerConfig(
            app_key="app-key",
            app_secret="app-secret",
            account_number="12345678",
        ),
        request_sender=sender,
    )

    submission = adapter.submit_order(
        OrderPlan(
            symbol="AAPL",
            action="BUY",
            quantity=3,
            broker_exchange_code="NASD",
            limit_price=199.75,
            should_submit=True,
            reason="ready",
        )
    )

    assert submission.accepted is True
    assert submission.broker_order_id == "A0001"
    assert [call["url"] for call in sender.calls] == [
        "https://openapivts.koreainvestment.com:29443/oauth2/tokenP",
        "https://openapivts.koreainvestment.com:29443/uapi/overseas-stock/v1/trading/order",
    ]
    assert sender.calls[1]["headers"]["tr_id"] == "VTTT1002U"
    assert sender.calls[1]["payload"]["OVRS_EXCG_CD"] == "NASD"
    assert sender.calls[1]["payload"]["OVRS_ORD_UNPR"] == "199.75"
    assert sender.calls[1]["payload"]["SLL_TYPE"] == ""


def test_kis_mock_broker_rejects_order_without_exchange_metadata() -> None:
    adapter = KisMockBrokerAdapter(
        KisMockBrokerConfig(
            app_key="app-key",
            app_secret="app-secret",
            account_number="12345678",
        )
    )

    submission = adapter.submit_order(
        OrderPlan(
            symbol="AAPL",
            action="BUY",
            quantity=1,
            broker_exchange_code=None,
            limit_price=199.75,
            should_submit=True,
            reason="ready",
        )
    )

    assert submission.accepted is False
    assert "broker_exchange_code" in submission.message


def test_kis_mock_broker_parses_account_snapshot() -> None:
    sender = RecordingSender()
    adapter = KisMockBrokerAdapter(
        KisMockBrokerConfig(
            app_key="app-key",
            app_secret="app-secret",
            account_number="12345678",
        ),
        request_sender=sender,
    )

    snapshot = adapter.get_account_snapshot()

    assert snapshot.available is True
    assert snapshot.broker == "kis_mock"
    assert snapshot.account_masked == "****5678"
    assert snapshot.summary is not None
    assert snapshot.summary.total_evaluation_amount == 125000.0
    assert snapshot.summary.total_profit_loss == 25000.0
    assert snapshot.summary.total_profit_loss_rate == 0.25
    assert len(snapshot.holdings) == 1
    assert snapshot.holdings[0].symbol == "AAPL"
    assert snapshot.holdings[0].profit_loss_rate == 0.25
    assert sender.calls[-1]["method"] == "GET"
    assert "/uapi/domestic-stock/v1/trading/inquire-balance" in str(sender.calls[-1]["url"])


def test_kis_mock_broker_supports_live_submission_only_with_account() -> None:
    adapter = KisMockBrokerAdapter(
        KisMockBrokerConfig(app_key="app-key", app_secret="app-secret", account_number="")
    )

    assert adapter.supports_live_submission is False
