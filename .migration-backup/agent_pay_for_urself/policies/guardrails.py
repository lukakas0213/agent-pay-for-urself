"""Policy guardrails that keep agent outputs inside the user's mandate."""

from agent_pay_for_urself.schemas import (
    InvestmentMandate,
    MandateViolation,
    OrderPlan,
    TradeDecision,
)


class PolicyGuardrail:
    """Clamp trade decisions and order plans that violate the user mandate."""

    def apply(
        self,
        mandate: InvestmentMandate,
        decisions: tuple[TradeDecision, ...],
        orders: tuple[OrderPlan, ...],
    ) -> tuple[tuple[TradeDecision, ...], tuple[OrderPlan, ...], tuple[MandateViolation, ...]]:
        violations: list[MandateViolation] = []
        guarded_decisions = tuple(
            self._guard_decision(mandate, decision, violations) for decision in decisions
        )
        guarded_orders = tuple(self._guard_order(order, violations) for order in orders)
        return guarded_decisions, guarded_orders, tuple(violations)

    def _guard_decision(
        self,
        mandate: InvestmentMandate,
        decision: TradeDecision,
        violations: list[MandateViolation],
    ) -> TradeDecision:
        symbol = decision.symbol.upper()
        allowed_symbols = {allowed.upper() for allowed in mandate.allowed_symbols}
        excluded_symbols = {excluded.upper() for excluded in mandate.excluded_symbols}

        if symbol in excluded_symbols:
            violations.append(
                MandateViolation(
                    symbol=decision.symbol,
                    rule="excluded_symbols",
                    message=f"{decision.symbol} is excluded by the investment mandate.",
                )
            )
            return self._hold_decision(decision, "excluded by investment mandate")

        if allowed_symbols and symbol not in allowed_symbols:
            violations.append(
                MandateViolation(
                    symbol=decision.symbol,
                    rule="allowed_symbols",
                    message=f"{decision.symbol} is outside the allowed mandate universe.",
                )
            )
            return self._hold_decision(decision, "outside allowed mandate universe")

        return decision

    def _guard_order(
        self,
        order: OrderPlan,
        violations: list[MandateViolation],
    ) -> OrderPlan:
        violation_by_symbol = {violation.symbol.upper(): violation for violation in violations}
        if order.symbol.upper() not in violation_by_symbol:
            return order

        violation = violation_by_symbol[order.symbol.upper()]
        return OrderPlan(
            symbol=order.symbol,
            action="HOLD",
            quantity=0,
            should_submit=False,
            reason=f"blocked by mandate guardrail: {violation.rule}",
        )

    def _hold_decision(self, decision: TradeDecision, reason: str) -> TradeDecision:
        return TradeDecision(
            symbol=decision.symbol,
            action="HOLD",
            confidence=0.0,
            rationale=f"Mandate guardrail blocked decision: {reason}.",
            risk_approved=False,
        )
