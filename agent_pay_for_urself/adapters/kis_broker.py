"""Korea Investment mock broker adapter.

This adapter follows the official Korea Investment mock-investment REST
contracts for OAuth token issuance and general overseas stock orders.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from agent_pay_for_urself.adapters.broker import BrokerAdapter, BrokerSubmission
from agent_pay_for_urself.schemas import OrderPlan

KIS_MOCK_BASE_URL = "https://openapivts.koreainvestment.com:29443"
KIS_TOKEN_PATH = "/oauth2/tokenP"
KIS_ORDER_PATH = "/uapi/overseas-stock/v1/trading/order"
DEFAULT_TIMEOUT_SECONDS = 10.0
TOKEN_REFRESH_SKEW_SECONDS = 60

BUY_ORDER_TR_ID = "VTTT1002U"
SELL_ORDER_TR_ID = "VTTT1006U"


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
        request_sender: callable | None = None,
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
            broker_order_id = self._pick_first_value(output, "ODNO", "odno", "ORD_NO", "ord_no")
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
                "Content-Type": "application/json",
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
        request = Request(
            url=url,
            method=method,
            headers=headers,
            data=json.dumps(payload).encode("utf-8"),
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

    def _format_limit_price(self, limit_price: float) -> str:
        return f"{limit_price:.2f}"

    def _pick_first_value(self, payload: dict[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
        return None
