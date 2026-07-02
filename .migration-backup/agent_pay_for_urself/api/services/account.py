"""Application service for broker account lookups."""

from agent_pay_for_urself.adapters.broker import BrokerAccountSnapshot, BrokerAdapter
from agent_pay_for_urself.api.models.account import (
    AccountConnectionItem,
    AccountCredentialStatusItem,
    AccountHoldingItem,
    AccountResponse,
    AccountSummaryItem,
)
from agent_pay_for_urself.repositories import (
    AccountConnectionRepository,
    AccountConnectionSettings,
)


class AccountService:
    """Fetch a normalized broker account snapshot through the adapter boundary."""

    def __init__(
        self,
        broker_adapter: BrokerAdapter,
        connection_repository: AccountConnectionRepository | None = None,
    ) -> None:
        self._broker_adapter = broker_adapter
        self._connection_repository = connection_repository

    def get(self) -> AccountResponse:
        """Return one account snapshot plus safe connection and credential metadata."""

        snapshot = self._broker_adapter.get_account_snapshot()
        connection = self._get_connection_settings(snapshot)
        return self._to_response(snapshot, connection)

    def _to_response(
        self,
        snapshot: BrokerAccountSnapshot,
        connection: AccountConnectionSettings,
    ) -> AccountResponse:
        return AccountResponse(
            available=snapshot.available,
            broker=snapshot.broker,
            account_masked=snapshot.account_masked,
            connection=AccountConnectionItem(
                alias=connection.alias,
                broker=connection.broker,
                account_number=connection.account_number,
                account_product_code=connection.account_product_code,
            ),
            credential_status=self._to_credential_status(snapshot, connection),
            summary=self._to_summary(snapshot.summary),
            holdings=[self._to_holding(item) for item in snapshot.holdings],
            message=snapshot.message,
        )

    def _get_connection_settings(
        self,
        snapshot: BrokerAccountSnapshot,
    ) -> AccountConnectionSettings:
        if self._connection_repository is not None:
            return self._connection_repository.get()
        return AccountConnectionSettings(broker=snapshot.broker)

    def _to_credential_status(
        self,
        snapshot: BrokerAccountSnapshot,
        connection: AccountConnectionSettings,
    ) -> AccountCredentialStatusItem:
        adapter_name = snapshot.broker
        if adapter_name == "noop":
            return AccountCredentialStatusItem(
                broker_adapter=adapter_name,
                uses_env_credentials=False,
                has_app_key=False,
                has_app_secret=False,
                ready_for_account_lookup=False,
                app_key_hint=None,
            )

        config = getattr(self._broker_adapter, "_config", None)
        app_key = str(getattr(config, "app_key", "")).strip()
        app_secret = str(getattr(config, "app_secret", "")).strip()
        account_number = (
            connection.account_number or str(getattr(config, "account_number", "")).strip()
        )
        product_code = (
            connection.account_product_code
            or str(getattr(config, "account_product_code", "")).strip()
        )
        return AccountCredentialStatusItem(
            broker_adapter=adapter_name,
            uses_env_credentials=bool(config is not None),
            has_app_key=bool(app_key),
            has_app_secret=bool(app_secret),
            ready_for_account_lookup=bool(
                app_key and app_secret and account_number and product_code
            ),
            app_key_hint=self._mask_app_key(app_key),
        )

    def _mask_app_key(self, app_key: str) -> str | None:
        if not app_key:
            return None
        if len(app_key) <= 4:
            return "*" * len(app_key)
        return f"{app_key[:2]}{'*' * (len(app_key) - 4)}{app_key[-2:]}"

    def _to_summary(
        self,
        summary: object | None,
    ) -> AccountSummaryItem | None:
        if summary is None:
            return None
        return AccountSummaryItem(
            cash_balance=summary.cash_balance,
            total_purchase_amount=summary.total_purchase_amount,
            total_evaluation_amount=summary.total_evaluation_amount,
            total_profit_loss=summary.total_profit_loss,
            total_profit_loss_rate=summary.total_profit_loss_rate,
        )

    def _to_holding(self, holding: object) -> AccountHoldingItem:
        return AccountHoldingItem(
            symbol=holding.symbol,
            name=holding.name,
            quantity=holding.quantity,
            average_price=holding.average_price,
            current_price=holding.current_price,
            market_value=holding.market_value,
            profit_loss=holding.profit_loss,
            profit_loss_rate=holding.profit_loss_rate,
        )
