"""Main agent orchestrator.

Agents do not call each other directly. The orchestrator owns the workflow,
interprets natural-language user input, and passes structured schemas between
each single-responsibility agent.
"""

from __future__ import annotations

import re
from dataclasses import replace

from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    ReportAgent,
)
from agent_pay_for_urself.llm import (
    AgentLLMClient,
    AgentLLMRequest,
    NoopAgentLLMClient,
    to_json_object,
)
from agent_pay_for_urself.policies import PolicyGuardrail
from agent_pay_for_urself.schemas import (
    InvestmentMandate,
    InvestmentRequest,
    SupervisorDirective,
    WorkflowResult,
)

COMPANY_SYMBOL_ALIASES = {
    "apple": "AAPL",
    "애플": "AAPL",
    "microsoft": "MSFT",
    "마이크로소프트": "MSFT",
    "tesla": "TSLA",
    "테슬라": "TSLA",
    "nvidia": "NVDA",
    "엔비디아": "NVDA",
    "amazon": "AMZN",
    "아마존": "AMZN",
    "alphabet": "GOOGL",
    "google": "GOOGL",
    "구글": "GOOGL",
    "meta": "META",
    "메타": "META",
}
TICKER_PATTERN = re.compile(r"[A-Z]{1,5}")


class MainAgent:
    """Coordinates the end-to-end investment decision workflow."""

    def __init__(
        self,
        data_collection_agent: DataCollectionAgent | None = None,
        data_analysis_agent: DataAnalysisAgent | None = None,
        report_agent: ReportAgent | None = None,
        buy_sell_agent: BuySellAgent | None = None,
        order_execution_agent: OrderExecutionAgent | None = None,
        log_evaluation_agent: LogEvaluationAgent | None = None,
        policy_guardrail: PolicyGuardrail | None = None,
        llm_client: AgentLLMClient | None = None,
    ) -> None:
        self.data_collection_agent = data_collection_agent or DataCollectionAgent()
        self.data_analysis_agent = data_analysis_agent or DataAnalysisAgent()
        self.report_agent = report_agent or ReportAgent()
        self.buy_sell_agent = buy_sell_agent or BuySellAgent()
        self.order_execution_agent = order_execution_agent or OrderExecutionAgent()
        self.log_evaluation_agent = log_evaluation_agent or LogEvaluationAgent()
        self.policy_guardrail = policy_guardrail or PolicyGuardrail()
        self.llm_client = llm_client or NoopAgentLLMClient()

    def run(self, request: InvestmentRequest) -> WorkflowResult:
        base_mandate = self._resolve_mandate(request)
        supervisor_directive = self._interpret_supervisor_directive(request, base_mandate)
        effective_request = self._apply_supervisor_directive(
            request,
            base_mandate,
            supervisor_directive,
        )
        mandate = effective_request.mandate or base_mandate
        prompt_overrides = effective_request.prompt_overrides
        market_data = self.data_collection_agent.collect(
            effective_request,
            prompt_override=prompt_overrides.data_collection,
        )
        analysis_signals = self.data_analysis_agent.analyze(
            market_data,
            prompt_override=prompt_overrides.data_analysis,
        )
        investment_reports = self.report_agent.write_reports(
            effective_request,
            market_data,
            analysis_signals,
            prompt_override=prompt_overrides.report,
        )
        trade_decisions = self.buy_sell_agent.decide(
            investment_reports,
            prompt_override=prompt_overrides.buy_sell,
        )
        order_plans = self.order_execution_agent.plan_orders(
            trade_decisions,
            market_data=market_data,
            prompt_override=prompt_overrides.order_execution,
        )
        trade_decisions, order_plans, mandate_violations = self.policy_guardrail.apply(
            mandate,
            trade_decisions,
            order_plans,
        )
        evaluation_log = self.log_evaluation_agent.summarize(
            trade_decisions,
            order_plans,
            prompt_override=prompt_overrides.log_evaluation,
        )

        return WorkflowResult(
            request=effective_request,
            mandate=mandate,
            supervisor_directive=supervisor_directive,
            market_data=market_data,
            analysis_signals=analysis_signals,
            investment_reports=investment_reports,
            trade_decisions=trade_decisions,
            order_plans=order_plans,
            evaluation_log=evaluation_log,
            mandate_violations=mandate_violations,
        )

    def _resolve_mandate(self, request: InvestmentRequest) -> InvestmentMandate:
        mandate = request.mandate or InvestmentMandate(
            max_position_weight=request.max_position_weight,
        )
        user_prompt = request.user_prompt.strip()
        if not user_prompt:
            return mandate
        if request.mandate is None:
            return replace(
                mandate,
                objective=user_prompt,
                max_position_weight=request.max_position_weight,
            )
        return replace(
            mandate,
            max_position_weight=request.max_position_weight,
            user_notes=self._join_notes(
                mandate.user_notes,
                f"Primary user prompt: {user_prompt}",
            ),
        )

    def _interpret_supervisor_directive(
        self,
        request: InvestmentRequest,
        mandate: InvestmentMandate,
    ) -> SupervisorDirective:
        fallback_directive = self._heuristic_supervisor_directive(request, mandate)
        if not self.llm_client.enabled:
            return fallback_directive

        system_instruction = (
            "You are the main investment supervisor. Interpret the user's long-term prompt "
            "and follow-up chat, then produce a conservative workflow directive. Return JSON "
            "only and preserve the same top-level keys, field names, and value types shown "
            "in fallback_payload. Never weaken the mandate, never promise execution, and use "
            "watch/focus symbols only when they are explicitly justified by the user input."
        )
        if request.prompt_overrides.main_agent.strip():
            system_instruction = (
                f"{system_instruction}\n\nAdditional run guidance:\n"
                f"{request.prompt_overrides.main_agent.strip()}"
            )
        llm_request = AgentLLMRequest(
            agent_name="main_agent",
            operation_name="interpret_user_intent",
            system_instruction=system_instruction,
            input_payload=to_json_object({"request": request, "mandate": mandate}),
            fallback_payload=to_json_object({"directive": fallback_directive}),
        )
        try:
            payload = self.llm_client.complete(llm_request)
            return self._parse_supervisor_payload(payload, fallback_directive)
        except Exception:
            return fallback_directive

    def _apply_supervisor_directive(
        self,
        request: InvestmentRequest,
        mandate: InvestmentMandate,
        directive: SupervisorDirective,
    ) -> InvestmentRequest:
        merged_symbols = self._merge_symbols(
            request.symbols,
            directive.focus_symbols,
            directive.watch_symbols,
        )
        merged_guidance = self._join_notes(
            mandate.user_notes,
            directive.summary,
            *directive.guidance,
        )
        resolved_mandate = replace(
            mandate,
            objective=directive.objective or mandate.objective,
            user_notes=merged_guidance,
        )
        return InvestmentRequest(
            symbols=merged_symbols,
            max_position_weight=request.max_position_weight,
            mandate=resolved_mandate,
            user_prompt=request.user_prompt,
            chat_messages=request.chat_messages,
            prompt_overrides=request.prompt_overrides,
        )

    def _heuristic_supervisor_directive(
        self,
        request: InvestmentRequest,
        mandate: InvestmentMandate,
    ) -> SupervisorDirective:
        objective = request.user_prompt.strip() or mandate.objective
        mentioned_symbols = self._extract_symbols(request.user_prompt, *request.chat_messages)
        focus_symbols = self._merge_symbols(request.symbols, mentioned_symbols)
        watch_symbols = tuple(
            symbol for symbol in mentioned_symbols if symbol not in request.symbols
        )
        guidance = tuple(message.strip() for message in request.chat_messages if message.strip())
        summary_parts: list[str] = []
        if objective:
            summary_parts.append(f"objective={objective}")
        if watch_symbols:
            summary_parts.append(f"watch={', '.join(watch_symbols)}")
        elif focus_symbols:
            summary_parts.append(f"focus={', '.join(focus_symbols)}")
        return SupervisorDirective(
            objective=objective,
            focus_symbols=focus_symbols,
            watch_symbols=watch_symbols,
            guidance=guidance,
            summary="; ".join(summary_parts),
        )

    def _parse_supervisor_payload(
        self,
        payload: dict[str, object],
        fallback_directive: SupervisorDirective,
    ) -> SupervisorDirective:
        directive_payload = payload.get("directive")
        if not isinstance(directive_payload, dict):
            raise ValueError("Supervisor response must include a directive object.")

        objective = (
            str(directive_payload.get("objective", "")).strip() or fallback_directive.objective
        )
        focus_symbols = self._normalize_symbol_list(
            directive_payload.get("focus_symbols"),
            fallback_directive.focus_symbols,
        )
        watch_symbols = self._normalize_symbol_list(
            directive_payload.get("watch_symbols"),
            fallback_directive.watch_symbols,
        )
        guidance = self._normalize_text_list(
            directive_payload.get("guidance"),
            fallback_directive.guidance,
        )
        summary = str(directive_payload.get("summary", "")).strip() or fallback_directive.summary
        return SupervisorDirective(
            objective=objective,
            focus_symbols=focus_symbols,
            watch_symbols=watch_symbols,
            guidance=guidance,
            summary=summary,
        )

    def _extract_symbols(self, *texts: str) -> tuple[str, ...]:
        extracted: list[str] = []
        for text in texts:
            normalized = text.strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            for alias, symbol in COMPANY_SYMBOL_ALIASES.items():
                if alias in lowered:
                    extracted.append(symbol)
            extracted.extend(TICKER_PATTERN.findall(normalized.upper()))
        return self._merge_symbols(tuple(), tuple(extracted))

    def _normalize_symbol_list(
        self,
        raw_value: object,
        fallback: tuple[str, ...],
    ) -> tuple[str, ...]:
        if not isinstance(raw_value, list):
            return fallback
        symbols = [str(item).strip().upper() for item in raw_value if str(item).strip()]
        return self._merge_symbols(tuple(), tuple(symbols))

    def _normalize_text_list(
        self,
        raw_value: object,
        fallback: tuple[str, ...],
    ) -> tuple[str, ...]:
        if not isinstance(raw_value, list):
            return fallback
        texts = tuple(str(item).strip() for item in raw_value if str(item).strip())
        return texts or fallback

    def _merge_symbols(self, *groups: tuple[str, ...]) -> tuple[str, ...]:
        ordered_symbols: list[str] = []
        for group in groups:
            for symbol in group:
                normalized = symbol.strip().upper()
                if normalized and normalized not in ordered_symbols:
                    ordered_symbols.append(normalized)
        return tuple(ordered_symbols)

    def _join_notes(self, *parts: str) -> str:
        return "\n".join(part.strip() for part in parts if part and part.strip())
