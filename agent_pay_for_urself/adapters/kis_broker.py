"""Korea Investment mock broker adapter.

This adapter follows the official Korea Investment mock-investment REST
contracts for OAuth token issuance and general overseas stock orders.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from agent_pay_for_urself.adapters.broker import (
    BrokerAccountHolding,
    BrokerAccountSnapshot,
    BrokerAccountSummary,
    BrokerAdapter,
    BrokerSubmission,
)
from agent_pay_for_urself.schemas import OrderPlan

KIS_MOCK_BASE_URL = "https://openapivts.koreainvestment.com:29443"
KIS_TOKEN_PATH = "/oauth2/tokenP"
KIS_ORDER_PATH = "/uapi/overseas-stock/v1/trading/order"
KIS_ACCOUNT_BALANCE_PATH = "/uapi/domestic-stock/v1/trading/inquire-balance"
DEFAULT_TIMEOUT_SECONDS = 10.0
TOKEN_REFRESH_SKEW_SECONDS = 60

BUY_ORDER_TR_ID = "VTTT1002U"
SELL_ORDER_TR_ID = "VTTT1006U"
ACCOUNT_BALANCE_TR_ID = "VTTC8434R"


@dataclass(frozen=True)
class KisMockBrokerConfig:
    """Configuration required for Korea Investment mock overseas orders."""

    app_key: str = ""
    app_secret: str = ""
    account_number: str = ""
    account_product_code: str = "01"
    base_url: str = KIS_MOCK_BASE_URL
    contact_phone: str = ""
    management_order_number: str = ""
    order_server_division_code: str = "0"
    order_division_code: str = "00"
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS

    def can_issue_token(self) -> bool:
        return bool(self.app_key and self.app_secret)

    def can_submit_orders(self) -> bool:
        return self.can_issue_token() and bool(self.account_number)


@dataclass(frozen=True)
class KisHttpResponse:
    """Normalized HTTP response payload returned by the adapter transport."""

    status_code: int
    payload: dict[str, Any]


class KisMockBrokerAdapter(BrokerAdapter):
    """Submit overseas mock-investment orders through Korea Investment REST APIs."""

    def __init__(
        self,
        config: KisMockBrokerConfig,
        request_sender: Callable[..., KisHttpResponse] | None = None,
    ) -> None:
        self._config = config
        self._request_sender = request_sender or self._default_request_sender
        self._access_token: str | None = None
        self._access_token_expires_at: datetime | None = None

    @property
    def supports_live_submission(self) -> bool:
        return self._config.can_submit_orders()

    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        """Submit one mock overseas stock order when required metadata is present."""

        if not self._config.can_issue_token():
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message="KIS mock broker credentials are not configured",
            )
        if not self._config.account_number:
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message="KIS mock broker account number is not configured",
            )
        if order_plan.action not in {"BUY", "SELL"}:
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message="KIS mock broker only accepts BUY or SELL orders",
            )
        if order_plan.quantity <= 0:
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message="KIS mock broker requires a positive quantity",
            )
        if order_plan.broker_exchange_code is None:
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message="KIS mock broker requires broker_exchange_code for overseas orders",
            )
        if order_plan.limit_price is None or order_plan.limit_price <= 0:
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message="KIS mock broker requires a positive limit_price for overseas orders",
            )

        token = self._get_access_token()
        response = self._request_json(
            path=KIS_ORDER_PATH,
            method="POST",
            headers={
                "authorization": f"Bearer {token}",
                "appkey": self._config.app_key,
                "appsecret": self._config.app_secret,
                "tr_id": BUY_ORDER_TR_ID if order_plan.action == "BUY" else SELL_ORDER_TR_ID,
                "custtype": "P",
                "tr_cont": "",
            },
            payload={
                "CANO": self._config.account_number,
                "ACNT_PRDT_CD": self._config.account_product_code,
                "OVRS_EXCG_CD": order_plan.broker_exchange_code,
                "PDNO": order_plan.symbol,
                "ORD_QTY": str(order_plan.quantity),
                "OVRS_ORD_UNPR": self._format_limit_price(order_plan.limit_price),
                "CTAC_TLNO": self._config.contact_phone,
                "MGCO_APTM_ODNO": self._config.management_order_number,
                "SLL_TYPE": "00" if order_plan.action == "SELL" else "",
                "ORD_SVR_DVSN_CD": self._config.order_server_division_code,
                "ORD_DVSN": self._config.order_division_code,
            },
        )
        payload = response.payload
        if payload.get("rt_cd") != "0":
            return BrokerSubmission(
                symbol=order_plan.symbol,
                accepted=False,
                broker_order_id=None,
                message=str(payload.get("msg1") or "KIS mock order rejected"),
            )

        output = payload.get("output")
        broker_order_id = None
        if isinstance(output, dict):
            broker_order_id = self._pick_first_string(output, "ODNO", "odno", "ORD_NO", "ord_no")
        return BrokerSubmission(
            symbol=order_plan.symbol,
            accepted=True,
            broker_order_id=broker_order_id,
            message=str(payload.get("msg1") or "submitted"),
        )

    def get_order_status(self, broker_order_id: str) -> str:
        """Return a minimal local status until explicit status polling is added."""

        if not broker_order_id:
            return "unavailable"
        return "submitted"

    def get_account_snapshot(self) -> BrokerAccountSnapshot:
        """Return one normalized mock-investment account balance snapshot."""

        if not self._config.can_issue_token():
            return self._unavailable_account_snapshot(
                "KIS mock broker credentials are not configured"
            )
        if not self._config.account_number:
            return self._unavailable_account_snapshot(
                "KIS mock broker account number is not configured"
            )

        try:
            token = self._get_access_token()
            response = self._request_json(
                path=KIS_ACCOUNT_BALANCE_PATH,
                method="GET",
                headers={
                    "authorization": f"Bearer {token}",
                    "appkey": self._config.app_key,
                    "appsecret": self._config.app_secret,
                    "tr_id": ACCOUNT_BALANCE_TR_ID,
                    "custtype": "P",
                    "tr_cont": "",
                },
                payload={
                    "CANO": self._config.account_number,
                    "ACNT_PRDT_CD": self._config.account_product_code,
                    "AFHR_FLPR_YN": "N",
                    "OFL_YN": "",
                    "INQR_DVSN": "02",
                    "UNPR_DVSN": "01",
                    "FUND_STTL_ICLD_YN": "Y",
                    "FNCG_AMT_AUTO_RDPT_YN": "N",
                    "PRCS_DVSN": "00",
                    "CTX_AREA_FK100": "",
                    "CTX_AREA_NK100": "",
                },
            )
        except RuntimeError as exc:
            return self._unavailable_account_snapshot(f"KIS mock account lookup failed: {exc}")

        payload = response.payload
        if payload.get("rt_cd") not in {None, "0", 0}:
            return self._unavailable_account_snapshot(
                str(payload.get("msg1") or "KIS mock account lookup rejected")
            )

        holdings = self._parse_holdings(payload)
        summary = self._parse_summary(payload, holdings)
        message = str(payload.get("msg1") or "ok")
        return BrokerAccountSnapshot(
            available=True,
            broker="kis_mock",
            account_masked=self._mask_account_number(self._config.account_number),
            summary=summary,
            holdings=tuple(holdings),
            message=message,
        )

    def _get_access_token(self) -> str:
        if self._access_token is not None and self._token_is_fresh():
            return self._access_token

        response = self._request_json(
            path=KIS_TOKEN_PATH,
            method="POST",
            headers={},
            payload={
                "grant_type": "client_credentials",
                "appkey": self._config.app_key,
                "appsecret": self._config.app_secret,
            },
        )
        payload = response.payload
        token = payload.get("access_token")
        if not isinstance(token, str) or not token:
            raise RuntimeError("KIS mock token response did not include access_token")

        self._access_token = token
        self._access_token_expires_at = self._parse_token_expiry(
            payload.get("access_token_token_expired")
        )
        return token

    def _token_is_fresh(self) -> bool:
        if self._access_token_expires_at is None:
            return True
        refresh_cutoff = datetime.now(UTC) + timedelta(seconds=TOKEN_REFRESH_SKEW_SECONDS)
        return self._access_token_expires_at > refresh_cutoff

    def _parse_token_expiry(self, raw_expiry: Any) -> datetime | None:
        if not isinstance(raw_expiry, str) or not raw_expiry.strip():
            return None
        try:
            parsed = datetime.strptime(raw_expiry.strip(), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
        return parsed.replace(tzinfo=UTC)

    def _request_json(
        self,
        path: str,
        method: str,
        headers: dict[str, str],
        payload: dict[str, Any],
    ) -> KisHttpResponse:
        response = self._request_sender(
            method=method,
            url=f"{self._config.base_url.rstrip('/')}{path}",
            headers={
                **({"Content-Type": "application/json"} if method != "GET" else {}),
                "Accept": "text/plain",
                "charset": "UTF-8",
                **headers,
            },
            payload=payload,
            timeout_seconds=self._config.timeout_seconds,
        )
        return response

    def _default_request_sender(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        timeout_seconds: float,
    ) -> KisHttpResponse:
        request_url = url
        body: bytes | None = None
        if method.upper() == "GET" and payload:
            query = urlencode(payload)
            request_url = f"{url}?{query}"
        elif payload:
            body = json.dumps(payload).encode("utf-8")

        request = Request(
            url=request_url,
            method=method,
            headers=headers,
            data=body,
        )
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                status_code = getattr(response, "status", response.getcode())
                body = json.loads(response.read().decode("utf-8"))
                return KisHttpResponse(status_code=status_code, payload=body)
        except HTTPError as exc:
            body = self._decode_error_body(exc)
            return KisHttpResponse(status_code=exc.code, payload=body)
        except URLError as exc:
            raise RuntimeError(f"KIS mock broker request failed: {exc.reason}") from exc

    def _decode_error_body(self, exc: HTTPError) -> dict[str, Any]:
        try:
            body = exc.read().decode("utf-8")
        except OSError:
            body = ""
        if not body:
            return {"rt_cd": str(exc.code), "msg1": exc.reason}
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            return {"rt_cd": str(exc.code), "msg1": body}
        if isinstance(parsed, dict):
            return parsed
        return {"rt_cd": str(exc.code), "msg1": body}

    def _parse_holdings(self, payload: dict[str, Any]) -> list[BrokerAccountHolding]:
        output = self._first_sequence(payload, "output1", "output", "output2")
        holdings: list[BrokerAccountHolding] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            symbol = self._pick_first_string(item, "pdno", "PDNO", "symbol") or ""
            if not symbol:
                continue
            name = self._pick_first_string(item, "prdt_name", "prdt_nm", "name") or symbol
            quantity = self._parse_int(item, "hldg_qty", "cblc_qty", "qty", default=0)
            average_price = self._parse_float(
                item,
                "pchs_avg_pric",
                "pchs_avg_price",
                "avg_pric",
                default=0.0,
            )
            current_price = self._parse_float(
                item,
                "prpr",
                "stck_prpr",
                "current_price",
                default=0.0,
            )
            market_value = self._parse_float(
                item,
                "evlu_amt",
                "tot_evlu_amt",
                "market_value",
                default=0.0,
            )
            if market_value == 0.0 and quantity and current_price:
                market_value = quantity * current_price
            if current_price == 0.0 and quantity:
                current_price = market_value / quantity if market_value else average_price
            purchase_amount = quantity * average_price
            profit_loss = self._parse_float(
                item,
                "evlu_pfls_amt",
                "eval_pfls_amt",
                "profit_loss",
                default=market_value - purchase_amount,
            )
            if purchase_amount > 0:
                profit_loss_rate = profit_loss / purchase_amount
            else:
                profit_loss_rate = self._normalize_rate(
                    self._pick_first_value(item, "evlu_pfls_rt", "profit_loss_rate"),
                    fallback=profit_loss,
                    base_amount=purchase_amount,
                )
            holdings.append(
                BrokerAccountHolding(
                    symbol=symbol,
                    name=name,
                    quantity=quantity,
                    average_price=average_price,
                    current_price=current_price,
                    market_value=market_value,
                    profit_loss=profit_loss,
                    profit_loss_rate=profit_loss_rate,
                )
            )
        return holdings

    def _parse_summary(
        self,
        payload: dict[str, Any],
        holdings: list[BrokerAccountHolding],
    ) -> BrokerAccountSummary:
        summary_payload = self._first_mapping(payload, "output2", "summary", "output")
        cash_balance = self._parse_float(
            summary_payload,
            "dnca_tot_amt",
            "dnca_tot_cash_amt",
            "cash_balance",
            default=0.0,
        )
        total_purchase_amount = self._parse_float(
            summary_payload,
            "pchs_amt_smtl_amt",
            "purchase_amount",
            default=0.0,
        )
        total_evaluation_amount = self._parse_float(
            summary_payload,
            "tot_evlu_amt",
            "evlu_amt",
            "evaluation_amount",
            default=0.0,
        )
        total_profit_loss = self._parse_float(
            summary_payload,
            "evlu_pfls_smtl_amt",
            "evlu_pfls_amt",
            "profit_loss",
            default=0.0,
        )

        if not holdings and total_evaluation_amount == 0.0 and total_purchase_amount == 0.0:
            return BrokerAccountSummary(
                cash_balance=cash_balance,
                total_purchase_amount=0.0,
                total_evaluation_amount=0.0,
                total_profit_loss=0.0,
                total_profit_loss_rate=0.0,
            )

        if total_purchase_amount <= 0:
            total_purchase_amount = sum(item.quantity * item.average_price for item in holdings)
        if total_evaluation_amount <= 0:
            total_evaluation_amount = sum(item.market_value for item in holdings)
        if total_profit_loss == 0.0:
            total_profit_loss = sum(item.profit_loss for item in holdings)
        if total_purchase_amount > 0:
            total_profit_loss_rate = total_profit_loss / total_purchase_amount
        else:
            total_profit_loss_rate = self._normalize_rate(
                self._pick_first_value(summary_payload, "evlu_pfls_smtl_rt", "profit_loss_rate"),
                fallback=total_profit_loss,
                base_amount=total_purchase_amount,
            )
        return BrokerAccountSummary(
            cash_balance=cash_balance,
            total_purchase_amount=total_purchase_amount,
            total_evaluation_amount=total_evaluation_amount,
            total_profit_loss=total_profit_loss,
            total_profit_loss_rate=total_profit_loss_rate,
        )

    def _first_sequence(self, payload: dict[str, Any], *keys: str) -> list[dict[str, Any]]:
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
            if isinstance(value, dict):
                return [value]
        return []

    def _first_mapping(self, payload: dict[str, Any], *keys: str) -> dict[str, Any]:
        for key in keys:
            value = payload.get(key)
            if isinstance(value, dict):
                return value
        return {}

    def _parse_float(
        self,
        payload: dict[str, Any],
        *keys: str,
        default: float,
    ) -> float:
        raw_value = self._pick_first_value(payload, *keys)
        if raw_value is None:
            return default
        parsed = self._coerce_float(raw_value)
        return default if parsed is None else parsed

    def _parse_int(
        self,
        payload: dict[str, Any],
        *keys: str,
        default: int,
    ) -> int:
        raw_value = self._pick_first_value(payload, *keys)
        if raw_value is None:
            return default
        parsed = self._coerce_int(raw_value)
        return default if parsed is None else parsed

    def _coerce_float(self, value: Any) -> float | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = value.strip().replace(",", "").replace("%", "")
            if not cleaned:
                return None
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    def _coerce_int(self, value: Any) -> int | None:
        parsed = self._coerce_float(value)
        if parsed is None:
            return None
        return int(parsed)

    def _normalize_rate(
        self,
        raw_rate: Any,
        *,
        fallback: float,
        base_amount: float,
    ) -> float:
        parsed = self._coerce_float(raw_rate)
        if parsed is None:
            if base_amount > 0:
                return fallback / base_amount
            return 0.0
        if abs(parsed) > 1.0:
            return parsed / 100.0
        return parsed

    def _unavailable_account_snapshot(self, message: str) -> BrokerAccountSnapshot:
        return BrokerAccountSnapshot(
            available=False,
            broker="kis_mock",
            account_masked=self._mask_account_number(self._config.account_number)
            if self._config.account_number
            else None,
            summary=None,
            holdings=(),
            message=message,
        )

    def _mask_account_number(self, account_number: str) -> str:
        if len(account_number) <= 4:
            return "*" * len(account_number)
        return f"{'*' * (len(account_number) - 4)}{account_number[-4:]}"

    def _format_limit_price(self, limit_price: float) -> str:
        return f"{limit_price:.2f}"

    def _pick_first_value(self, payload: dict[str, Any], *keys: str) -> Any:
        for key in keys:
            value = payload.get(key)
            if value not in {None, ""}:
                return value
        return None

    def _pick_first_string(self, payload: dict[str, Any], *keys: str) -> str | None:
        value = self._pick_first_value(payload, *keys)
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        if value is None:
            return None
        return str(value)
