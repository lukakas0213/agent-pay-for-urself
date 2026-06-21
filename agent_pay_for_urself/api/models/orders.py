"""Request and response models for live order submission."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from agent_pay_for_urself.api.models.decisions import TradeAction


class LiveOrderSubmitRequest(BaseModel):
    """Request body for submitting stored order plans to the configured broker."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "run_id": "run_123",
                    "symbols": ["AAPL"],
                    "confirm_live_order": True,
                }
            ]
        }
    )

    run_id: str = Field(description="Stored workflow run id returned by POST /decisions.")
    symbols: list[str] = Field(
        default_factory=list,
        description=(
            "Optional subset of symbols from the stored run to submit. Empty means all "
            "stored order plans in the run are considered."
        ),
    )
    confirm_live_order: bool = Field(
        default=False,
        description="Explicit confirmation that this request is allowed to submit broker orders.",
    )

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, symbols: list[str]) -> list[str]:
        cleaned_symbols = [symbol.strip() for symbol in symbols]
        if any(not symbol for symbol in cleaned_symbols):
            raise ValueError("Each symbol must contain non-whitespace characters.")
        return cleaned_symbols


class DirectOrderSubmitRequest(BaseModel):
    """Request body for submitting one broker order directly."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "symbol": "AAPL",
                    "action": "BUY",
                    "quantity": 1,
                    "broker_exchange_code": "NASD",
                    "limit_price": 201.25,
                    "confirm_live_order": True,
                }
            ]
        }
    )

    symbol: str = Field(description="Stock symbol to submit directly to the broker.")
    action: TradeAction = Field(description="Direct broker action. Only BUY or SELL are valid.")
    quantity: int = Field(gt=0, description="Positive order quantity to submit.")
    broker_exchange_code: str | None = Field(
        default=None,
        description="Optional broker exchange code required by some overseas broker adapters.",
    )
    limit_price: float | None = Field(
        default=None,
        gt=0,
        description="Optional limit price to submit with the broker order.",
    )
    confirm_live_order: bool = Field(
        default=False,
        description="Explicit confirmation that this request is allowed to submit broker orders.",
    )

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, symbol: str) -> str:
        cleaned_symbol = symbol.strip().upper()
        if not cleaned_symbol:
            raise ValueError("symbol must contain non-whitespace characters.")
        return cleaned_symbol

    @field_validator("broker_exchange_code")
    @classmethod
    def normalize_broker_exchange_code(cls, broker_exchange_code: str | None) -> str | None:
        if broker_exchange_code is None:
            return None
        cleaned_code = broker_exchange_code.strip().upper()
        return cleaned_code or None


class LiveOrderSubmissionItem(BaseModel):
    """One attempted broker submission for a stored order plan."""

    symbol: str = Field(description="Uppercase stock symbol submitted to the broker.")
    action: TradeAction = Field(description="Stored order action sent to the broker.")
    quantity: int = Field(description="Stored order quantity sent to the broker.")
    broker_exchange_code: str | None = Field(
        default=None,
        description="Korea Investment overseas exchange code used for submission.",
    )
    limit_price: float | None = Field(
        default=None,
        description="Limit price sent to the broker for the stored order plan.",
    )
    accepted: bool = Field(description="Whether the broker accepted the submission.")
    broker_order_id: str | None = Field(
        default=None,
        description="Broker-side order identifier when the submission was accepted.",
    )
    message: str = Field(description="Broker submission result message.")


class LiveOrderSkippedItem(BaseModel):
    """One stored order plan that was not submitted."""

    symbol: str = Field(description="Stored order symbol that was skipped.")
    action: TradeAction | None = Field(
        default=None,
        description="Stored action when an order plan existed for the symbol.",
    )
    quantity: int | None = Field(
        default=None,
        description="Stored quantity when an order plan existed for the symbol.",
    )
    reason: str = Field(description="Why the symbol was not submitted to the broker.")


class LiveOrderSubmitResponse(BaseModel):
    """Summary of one live order submission request."""

    run_id: str = Field(description="Stored workflow run id used for this submission request.")
    requested_symbols: list[str] = Field(description="Requested symbol filter for this submission.")
    live_order_enabled: bool = Field(
        description="Whether the configured runtime supports live broker submission."
    )
    mandate_requires_approval: bool = Field(
        description="Whether the stored workflow mandate required explicit live-order approval."
    )
    accepted_order_count: int = Field(description="Number of broker submissions accepted.")
    rejected_order_count: int = Field(description="Number of broker submissions rejected.")
    skipped_order_count: int = Field(description="Number of stored order plans skipped.")
    submissions: list[LiveOrderSubmissionItem] = Field(
        description="Attempted broker submissions for executable stored order plans."
    )
    skipped_orders: list[LiveOrderSkippedItem] = Field(
        description="Stored order plans or requested symbols that were not submitted."
    )


class DirectOrderSubmitResponse(BaseModel):
    """Summary of one direct broker order submission request."""

    live_order_enabled: bool = Field(
        description="Whether the configured runtime supports live broker submission."
    )
    submission: LiveOrderSubmissionItem = Field(
        description="Result of the direct broker submission attempt."
    )
