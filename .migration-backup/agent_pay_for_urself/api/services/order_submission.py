"""Application service for explicit live broker order submission."""

from __future__ import annotations

import logging

from agent_pay_for_urself.adapters.broker import BrokerSubmission
from agent_pay_for_urself.api.models.orders import (
    DirectOrderSubmitRequest,
    DirectOrderSubmitResponse,
    LiveOrderSkippedItem,
    LiveOrderSubmissionItem,
    LiveOrderSubmitRequest,
    LiveOrderSubmitResponse,
)
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories.workflow_runs import WorkflowRunRepository
from agent_pay_for_urself.schemas import OrderPlan

logger = logging.getLogger(__name__)


class OrderSubmissionService:
    """Submits stored executable order plans through the configured broker adapter."""

    def __init__(
        self,
        main_agent: MainAgent,
        workflow_run_repository: WorkflowRunRepository,
    ) -> None:
        self._main_agent = main_agent
        self._workflow_run_repository = workflow_run_repository

    def submit(self, request: LiveOrderSubmitRequest) -> LiveOrderSubmitResponse:
        """Submit executable stored orders when the caller confirms live submission."""

        self._ensure_live_submission_enabled(request.confirm_live_order)

        result = self._workflow_run_repository.get(request.run_id)
        if result is None:
            raise LookupError(f"workflow run not found: {request.run_id}")

        requested_symbols = self._normalize_requested_symbols(request.symbols)
        all_orders = result.order_plans
        orders_by_symbol = {order.symbol: order for order in all_orders}

        skipped_orders: list[LiveOrderSkippedItem] = []
        executable_orders: list[OrderPlan] = []

        for symbol in requested_symbols:
            if symbol not in orders_by_symbol:
                skipped_orders.append(
                    LiveOrderSkippedItem(
                        symbol=symbol,
                        reason="symbol not found in stored order plans",
                    )
                )

        for order in all_orders:
            if requested_symbols and order.symbol not in requested_symbols:
                continue
            skip_reason = self._get_skip_reason(order)
            if skip_reason is not None:
                skipped_orders.append(
                    LiveOrderSkippedItem(
                        symbol=order.symbol,
                        action=order.action,
                        quantity=order.quantity,
                        reason=skip_reason,
                    )
                )
                continue
            executable_orders.append(order)

        submission_items = self._submit_order_plans(tuple(executable_orders))
        accepted_order_count = sum(1 for submission in submission_items if submission.accepted)
        rejected_order_count = len(submission_items) - accepted_order_count

        response = LiveOrderSubmitResponse(
            run_id=request.run_id,
            requested_symbols=list(requested_symbols),
            live_order_enabled=True,
            mandate_requires_approval=result.mandate.requires_approval_for_live_orders,
            accepted_order_count=accepted_order_count,
            rejected_order_count=rejected_order_count,
            skipped_order_count=len(skipped_orders),
            submissions=submission_items,
            skipped_orders=skipped_orders,
        )
        logger.info(
            (
                "live_order_submission_completed run_id=%s submitted=%s "
                "accepted=%s rejected=%s skipped=%s"
            ),
            request.run_id,
            len(submission_items),
            accepted_order_count,
            rejected_order_count,
            len(skipped_orders),
        )
        return response

    def submit_direct(self, request: DirectOrderSubmitRequest) -> DirectOrderSubmitResponse:
        """Submit one explicit order plan through the configured broker adapter."""

        self._ensure_live_submission_enabled(request.confirm_live_order)

        order_plan = OrderPlan(
            symbol=request.symbol,
            action=request.action,
            quantity=request.quantity,
            broker_exchange_code=request.broker_exchange_code,
            limit_price=request.limit_price,
            should_submit=True,
            reason="direct submission request",
        )
        submission = self._submit_single_order(order_plan)
        response = DirectOrderSubmitResponse(
            live_order_enabled=True,
            submission=submission,
        )
        logger.info(
            "direct_order_submission_completed symbol=%s action=%s quantity=%s accepted=%s",
            order_plan.symbol,
            order_plan.action,
            order_plan.quantity,
            submission.accepted,
        )
        return response

    def _ensure_live_submission_enabled(self, confirm_live_order: bool) -> None:
        if not confirm_live_order:
            raise ValueError("confirm_live_order must be true to submit broker orders")

        order_execution_agent = self._main_agent.order_execution_agent
        if not order_execution_agent.broker_adapter.supports_live_submission:
            raise RuntimeError("live broker submission is not enabled for the current runtime")

    def _submit_order_plans(
        self, order_plans: tuple[OrderPlan, ...]
    ) -> list[LiveOrderSubmissionItem]:
        if not order_plans:
            return []

        order_execution_agent = self._main_agent.order_execution_agent
        submissions = order_execution_agent.submit_orders(order_plans)
        if len(submissions) != len(order_plans):
            raise RuntimeError("broker submission count did not match executable order count")
        return [
            self._to_submission_item(order_plan, submission)
            for order_plan, submission in zip(order_plans, submissions, strict=True)
        ]

    def _submit_single_order(self, order_plan: OrderPlan) -> LiveOrderSubmissionItem:
        submission_items = self._submit_order_plans((order_plan,))
        if not submission_items:
            raise RuntimeError("direct order plan was not submitted")
        return submission_items[0]

    def _to_submission_item(
        self,
        order_plan: OrderPlan,
        submission: BrokerSubmission,
    ) -> LiveOrderSubmissionItem:
        return LiveOrderSubmissionItem(
            symbol=order_plan.symbol,
            action=order_plan.action,
            quantity=order_plan.quantity,
            broker_exchange_code=order_plan.broker_exchange_code,
            limit_price=order_plan.limit_price,
            accepted=submission.accepted,
            broker_order_id=submission.broker_order_id,
            message=submission.message,
        )

    def _normalize_requested_symbols(self, symbols: list[str]) -> tuple[str, ...]:
        if not symbols:
            return ()

        normalized: list[str] = []
        seen: set[str] = set()
        for symbol in symbols:
            upper_symbol = symbol.upper()
            if upper_symbol in seen:
                continue
            seen.add(upper_symbol)
            normalized.append(upper_symbol)
        return tuple(normalized)

    def _get_skip_reason(self, order: OrderPlan) -> str | None:
        if not order.should_submit:
            return f"stored order plan is not executable: {order.reason}"
        if order.action not in {"BUY", "SELL"}:
            return f"stored order action is not supported for broker submission: {order.action}"
        return None
