"""Validation helpers that map JSON-like LLM payloads back to workflow schemas."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from agent_pay_for_urself.schemas import (
    AnalysisSignal,
    EvaluationLog,
    MarketData,
    OrderPlan,
    RiskAssessment,
    TradeDecision,
)

VALID_TRADE_ACTIONS = {"BUY", "SELL", "HOLD"}


def parse_market_data_items(value: Any) -> tuple[MarketData, ...]:
    return tuple(_parse_market_data_item(item) for item in _require_sequence(value))


def parse_analysis_signals(value: Any) -> tuple[AnalysisSignal, ...]:
    return tuple(_parse_analysis_signal(item) for item in _require_sequence(value))


def parse_risk_assessments(value: Any) -> tuple[RiskAssessment, ...]:
    return tuple(_parse_risk_assessment(item) for item in _require_sequence(value))


def parse_trade_decisions(value: Any) -> tuple[TradeDecision, ...]:
    return tuple(_parse_trade_decision(item) for item in _require_sequence(value))


def parse_order_plans(value: Any) -> tuple[OrderPlan, ...]:
    return tuple(_parse_order_plan(item) for item in _require_sequence(value))


def parse_evaluation_log(value: Any) -> EvaluationLog:
    item = _require_mapping(value)
    return EvaluationLog(
        decision_count=int(item["decision_count"]),
        order_count=int(item["order_count"]),
        blocked_order_count=int(item["blocked_order_count"]),
        notes=tuple(str(note) for note in _require_sequence(item["notes"])),
    )


def _parse_market_data_item(value: Any) -> MarketData:
    item = _require_mapping(value)
    return MarketData(
        symbol=str(item["symbol"]),
        latest_price=float(item["latest_price"]),
        news_headlines=tuple(
            str(headline) for headline in _require_sequence(item["news_headlines"])
        ),
        financial_metrics={
            str(key): float(metric)
            for key, metric in _require_mapping(item["financial_metrics"]).items()
        },
    )


def _parse_analysis_signal(value: Any) -> AnalysisSignal:
    item = _require_mapping(value)
    return AnalysisSignal(
        symbol=str(item["symbol"]),
        price_score=float(item["price_score"]),
        news_score=float(item["news_score"]),
        financial_score=float(item["financial_score"]),
        rationale=str(item["rationale"]),
    )


def _parse_risk_assessment(value: Any) -> RiskAssessment:
    item = _require_mapping(value)
    return RiskAssessment(
        symbol=str(item["symbol"]),
        approved=bool(item["approved"]),
        reasons=tuple(str(reason) for reason in _require_sequence(item["reasons"])),
        max_position_weight=float(item["max_position_weight"]),
    )


def _parse_trade_decision(value: Any) -> TradeDecision:
    item = _require_mapping(value)
    action = str(item["action"])
    if action not in VALID_TRADE_ACTIONS:
        raise ValueError(f"Unsupported trade action: {action}")
    return TradeDecision(
        symbol=str(item["symbol"]),
        action=action,
        confidence=float(item["confidence"]),
        rationale=str(item["rationale"]),
        risk_approved=bool(item["risk_approved"]),
    )


def _parse_order_plan(value: Any) -> OrderPlan:
    item = _require_mapping(value)
    action = str(item["action"])
    if action not in VALID_TRADE_ACTIONS:
        raise ValueError(f"Unsupported trade action: {action}")
    return OrderPlan(
        symbol=str(item["symbol"]),
        action=action,
        quantity=int(item["quantity"]),
        should_submit=bool(item["should_submit"]),
        reason=str(item["reason"]),
    )


def _require_mapping(value: Any) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(f"Expected mapping payload, got {type(value)!r}")
    return value


def _require_sequence(value: Any) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise TypeError(f"Expected sequence payload, got {type(value)!r}")
    return value
