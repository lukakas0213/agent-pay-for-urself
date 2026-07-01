"""Request and response models for broker account lookups."""

from pydantic import BaseModel, Field, field_validator


class AccountConnectionRequest(BaseModel):
    """Broker account identifiers written by the user."""

    alias: str = Field(default="메인 계좌", max_length=80)
    broker: str = Field(default="kis_mock", max_length=40)
    account_number: str = Field(default="", max_length=40)
    account_product_code: str = Field(default="01", max_length=8)

    @field_validator("alias", "broker", "account_number", "account_product_code")
    @classmethod
    def trim_value(cls, value: str) -> str:
        return value.strip()


class AccountConnectionItem(BaseModel):
    """Current persisted account connection settings."""

    alias: str = Field(description="Display alias for the connected account.")
    broker: str = Field(description="Broker key used for the current connection.")
    account_number: str = Field(description="Editable account number used for lookups.")
    account_product_code: str = Field(description="Editable product code used for lookups.")


class AccountCredentialStatusItem(BaseModel):
    """Safe view of whether broker credentials are available from env."""

    broker_adapter: str = Field(description="Resolved runtime broker adapter key.")
    uses_env_credentials: bool = Field(description="Whether API credentials come from env.")
    has_app_key: bool = Field(description="Whether the runtime app key is configured.")
    has_app_secret: bool = Field(description="Whether the runtime app secret is configured.")
    ready_for_account_lookup: bool = Field(
        description="Whether env credentials plus account identifiers can query holdings."
    )
    app_key_hint: str | None = Field(
        default=None,
        description="Masked app key hint safe to render in the frontend.",
    )


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
    """Broker account snapshot exposed by the account endpoints."""

    available: bool = Field(description="Whether the account snapshot could be loaded.")
    broker: str = Field(description="Broker adapter name used for the lookup.")
    account_masked: str | None = Field(
        default=None,
        description="Masked account number when the broker exposes one.",
    )
    connection: AccountConnectionItem = Field(
        description="Current persisted broker account connection settings."
    )
    credential_status: AccountCredentialStatusItem = Field(
        description="Safe broker credential availability summary."
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
