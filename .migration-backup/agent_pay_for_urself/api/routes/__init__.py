"""FastAPI routers exposed by the application."""

from agent_pay_for_urself.api.routes.account import router as account_router
from agent_pay_for_urself.api.routes.agent_prompts import router as agent_prompts_router
from agent_pay_for_urself.api.routes.console import router as console_router
from agent_pay_for_urself.api.routes.decisions import router as decisions_router
from agent_pay_for_urself.api.routes.experiments import router as experiments_router
from agent_pay_for_urself.api.routes.health import router as health_router
from agent_pay_for_urself.api.routes.market_data import router as market_data_router
from agent_pay_for_urself.api.routes.orders import router as orders_router

__all__ = [
    "account_router",
    "agent_prompts_router",
    "console_router",
    "decisions_router",
    "experiments_router",
    "health_router",
    "market_data_router",
    "orders_router",
]
