"""FastAPI app factory."""

from __future__ import annotations

from fastapi import FastAPI

from agent_pay_for_urself.api.logging import install_request_logging
from agent_pay_for_urself.api.routes import (
    account_router,
    agent_prompts_router,
    console_router,
    decisions_router,
    experiments_router,
    health_router,
    history_router,
    market_data_router,
    orders_router,
)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="agent-pay-for-urself",
        summary="Multi-agent investment decision support API.",
        description=(
            "Runs an investment-support workflow for requested stock symbols. "
            "The workflow returns order plans, and explicit order submission endpoints can "
            "send broker orders when enabled."
        ),
    )
    install_request_logging(app)
    app.include_router(health_router)
    app.include_router(account_router)
    app.include_router(history_router)
    app.include_router(market_data_router)
    app.include_router(decisions_router)
    app.include_router(orders_router)
    app.include_router(agent_prompts_router)
    app.include_router(experiments_router)
    app.include_router(console_router)
    return app
