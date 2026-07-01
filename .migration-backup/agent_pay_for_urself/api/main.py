"""FastAPI entrypoint for the investment agent platform."""

from agent_pay_for_urself.api.app import create_app

app = create_app()
