"""FastAPI routers exposed by the application."""

from agent_pay_for_urself.api.routes.console import router as console_router
from agent_pay_for_urself.api.routes.decisions import router as decisions_router
from agent_pay_for_urself.api.routes.health import router as health_router

__all__ = ["console_router", "decisions_router", "health_router"]
