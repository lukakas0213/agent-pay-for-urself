"""Application service for broker account lookups."""

from agent_pay_for_urself.adapters.broker import BrokerAccountSnapshot, BrokerAdapter
from agent_pay_for_urself.api.models.account import (
    AccountHoldingItem,
    AccountResponse,
    AccountSummaryItem,
)


class AccountService:
    """Fetch a normalized broker account snapshot through the adapter boundary."""

    def __init__(self, broker_adapter: BrokerAdapter) -> None:
        self._broker_adapter = broker_adapter

    def get(self) -> AccountResponse:
        """Return one account snapshot, even when the broker lookup is unavailable."""

        snapshot = self._broker_adapter.get_account_snapshot()
        return self._to_response(snapshot)

    def _to_response(self, snapshot: BrokerAccountSnapshot) -> AccountResponse:
        return AccountResponse(
            available=snapshot.available,
            broker=snapshot.broker,
            account_masked=snapshot.account_masked,
            summary=self._to_summary(snapshot.summary),
            holdings=[self._to_holding(item) for item in snapshot.holdings],
            message=snapshot.message,
        )

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
