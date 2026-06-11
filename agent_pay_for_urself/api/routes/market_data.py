"""Direct market data lookup route."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from agent_pay_for_urself.api.dependencies import get_market_data_service
from agent_pay_for_urself.api.mappers.workflow import to_market_data_item
from agent_pay_for_urself.api.models import MarketDataItem
from agent_pay_for_urself.api.services.market_data import MarketDataService

router = APIRouter(tags=["market-data"])
MarketDataLookupService = Annotated[MarketDataService, Depends(get_market_data_service)]


@router.get(
    "/market-data/{symbol}",
    response_model=MarketDataItem,
    summary="Fetch market data for one symbol",
    description=(
        "Returns normalized market data for one symbol through the configured market data "
        "provider. The provider is selected by MARKET_DATA_PROVIDER and may be the "
        "deterministic stub or Yahoo Finance."
    ),
)
def get_market_data(
    symbol: str,
    market_data_service: MarketDataLookupService,
) -> MarketDataItem:
    """Return direct market data lookup output without running the full workflow."""

    try:
        return to_market_data_item(market_data_service.get(symbol))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"market data lookup failed: {exc}") from exc
