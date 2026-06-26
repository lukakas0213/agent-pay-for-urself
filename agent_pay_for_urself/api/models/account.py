"""Request and response models for broker account lookups."""

from pydantic import BaseModel, Field


class AccountHoldingItem(BaseModel):
    """One holding in the configured broker account."""

    symbol: str = Field(description="Uppercase stock symbol for the holding.")
    name: str = Field(description="Display name for the holding.")
    quantity: int = Field(description="Held quantity.")
    average_price: float = Field(description="Average acquisition price for the holding.")
    current_price: float = Field(description="Current price used for valuation.")
    market_value: float = Field(description="Holding market value.")
    profit_loss: float = Field(description="Holding profit or loss in account currency.")
    profit_loss_rate: float = Field(
        description="Holding profit or loss rate as a decimal fraction, not percent."
    )


class AccountSummaryItem(BaseModel):
    """Overall account summary returned by the broker."""

    cash_balance: float = Field(description="Available cash balance in the account.")
    total_purchase_amount: float = Field(description="Total acquisition amount for holdings.")
    total_evaluation_amount: float = Field(description="Total evaluation amount for holdings.")
    total_profit_loss: float = Field(description="Total profit or loss for the account.")
    total_profit_loss_rate: float = Field(
        description="Total profit or loss rate as a decimal fraction, not percent."
    )


class AccountResponse(BaseModel):
    """Broker account snapshot exposed by GET /account."""

    available: bool = Field(description="Whether the account snapshot could be loaded.")
    broker: str = Field(description="Broker adapter name used for the lookup.")
    account_masked: str | None = Field(
        default=None,
        description="Masked account number when the broker exposes one.",
    )
    summary: AccountSummaryItem | None = Field(
        default=None,
        description="Overall account summary when the lookup succeeds.",
    )
    holdings: list[AccountHoldingItem] = Field(
        default_factory=list,
        description="Normalized holdings currently visible in the account.",
    )
    message: str = Field(description="Status or error message for the lookup result.")
