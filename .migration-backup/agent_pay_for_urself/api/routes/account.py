"""Broker account lookup route."""

from typing import Annotated

from fastapi import APIRouter, Depends

from agent_pay_for_urself.api.dependencies import get_account_service
from agent_pay_for_urself.api.models.account import AccountResponse
from agent_pay_for_urself.api.services.account import AccountService

router = APIRouter(tags=["account"])
AccountLookupService = Annotated[AccountService, Depends(get_account_service)]


@router.get(
    "/account",
    response_model=AccountResponse,
    summary="Fetch broker account holdings",
    description=(
        "Returns a normalized broker account snapshot from the configured mock-investment "
        "adapter. When the adapter or KIS credentials are unavailable, the response stays "
        "200 and explains why the snapshot could not be loaded."
    ),
)
def get_account(account_service: AccountLookupService) -> AccountResponse:
    """Return one account snapshot for the configured broker adapter."""

    return account_service.get()
