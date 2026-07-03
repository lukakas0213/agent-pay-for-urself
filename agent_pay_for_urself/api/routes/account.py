"""Broker account lookup route."""

from typing import Annotated

from fastapi import APIRouter, Depends

from agent_pay_for_urself.api.dependencies import get_account_service
from agent_pay_for_urself.api.models.account import (
    AccountConnectionItem,
    AccountConnectionRequest,
    AccountResponse,
)
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


@router.get(
    "/account/connection",
    response_model=AccountConnectionItem,
    summary="Get persisted broker account connection",
)
def get_account_connection(account_service: AccountLookupService) -> AccountConnectionItem:
    """Return the persisted broker account connection settings."""

    return account_service.get_connection()


@router.put(
    "/account/connection",
    response_model=AccountConnectionItem,
    summary="Update persisted broker account connection",
)
def update_account_connection(
    request: AccountConnectionRequest,
    account_service: AccountLookupService,
) -> AccountConnectionItem:
    """Persist broker account connection settings and return the saved values."""

    return account_service.update_connection(request)
