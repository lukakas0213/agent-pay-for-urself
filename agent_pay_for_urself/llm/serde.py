"""Validation helpers that map JSON-like LLM payloads back to workflow schemas."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from agent_pay_for_urself.schemas import (
    AnalysisSignal,
    EvaluationLog,
    InvestmentReport,
    MarketData,
    OrderPlan,
    TradeDecision,
)

VALID_TRADE_ACTIONS = {"BUY", "SELL", "HOLD"}


def parse_market_data_items(value: Any) -> tuple[MarketData, ...]:
    return tuple(_parse_market_data_item(item) for item in _require_sequence(value))


def parse_analysis_signals(value: Any) -> tuple[AnalysisSignal, ...]:
    return tuple(_parse_analysis_signal(item) for item in _require_sequence(value))


def parse_investment_reports(value: Any) -> tuple[InvestmentReport, ...]:
    return tuple(_parse_investment_report(item) for item in _require_sequence(value))


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
        broker_exchange_code=_optional_string(item.get("broker_exchange_code")),
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


def _parse_investment_report(value: Any) -> InvestmentReport:
    item = _require_mapping(value)
    action = str(item["recommended_action_bias"])
    if action not in VALID_TRADE_ACTIONS:
        raise ValueError(f"Unsupported trade action: {action}")
    return InvestmentReport(
        symbol=str(item["symbol"]),
        summary=str(item["summary"]),
        bull_points=tuple(str(point) for point in _require_sequence(item["bull_points"])),
        bear_points=tuple(str(point) for point in _require_sequence(item["bear_points"])),
        risk_flags=tuple(str(flag) for flag in _require_sequence(item["risk_flags"])),
        risk_approved=bool(item["risk_approved"]),
        max_position_weight=float(item["max_position_weight"]),
        recommended_action_bias=action,
        signal_strength=float(item["signal_strength"]),
        rationale=str(item["rationale"]),
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
        broker_exchange_code=_optional_string(item.get("broker_exchange_code")),
        limit_price=_optional_float(item.get("limit_price")),
        should_submit=bool(item["should_submit"]),
        reason=str(item["reason"]),
    )


def _require_mapping(value: Any) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(f"Expected mapping payload, got {type(value)!r}")
    return value


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _require_sequence(value: Any) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise TypeError(f"Expected sequence payload, got {type(value)!r}")
    return value
