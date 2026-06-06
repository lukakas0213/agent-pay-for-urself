"""FastAPI entrypoint for the investment agent platform."""

from fastapi import FastAPI
from pydantic import BaseModel, Field

from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.schemas import InvestmentRequest

app = FastAPI(title="agent-pay-for-urself")
main_agent = MainAgent()


class DecisionRequest(BaseModel):
    symbols: list[str] = Field(min_length=1)
    max_position_weight: float = Field(default=0.2, gt=0, le=1)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/decisions")
def create_decision(request: DecisionRequest) -> dict[str, object]:
    result = main_agent.run(
        InvestmentRequest(
            symbols=tuple(request.symbols),
            max_position_weight=request.max_position_weight,
        )
    )
    return {
        "symbols": list(result.request.symbols),
        "decisions": [
            {
                "symbol": decision.symbol,
                "action": decision.action,
                "confidence": decision.confidence,
                "rationale": decision.rationale,
                "risk_approved": decision.risk_approved,
            }
            for decision in result.trade_decisions
        ],
        "orders": [
            {
                "symbol": order.symbol,
                "action": order.action,
                "quantity": order.quantity,
                "should_submit": order.should_submit,
                "reason": order.reason,
            }
            for order in result.order_plans
        ],
    }
