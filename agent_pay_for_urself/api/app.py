"""FastAPI app factory."""

from fastapi import FastAPI

from agent_pay_for_urself.api.routes import console_router, decisions_router, health_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="agent-pay-for-urself",
        summary="Multi-agent investment decision support API.",
        description=(
            "Runs a deterministic investment-support workflow for requested stock symbols. "
            "The current implementation does not submit real broker orders."
        ),
    )
    app.include_router(health_router)
    app.include_router(decisions_router)
    app.include_router(console_router)
    return app
