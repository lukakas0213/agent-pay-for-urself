"""Request and response models for durable workflow run history."""

from typing import Literal

from pydantic import BaseModel, Field

from agent_pay_for_urself.api.models.decisions import DecisionResponse, TradeAction

AgentConnectionStatus = Literal["running", "connected", "disconnected"]
WorkflowBranchType = Literal["initial", "followup_rerun"]


class AgentStatusItem(BaseModel):
    """Current UI-facing status for one workflow agent."""

    agent_key: str = Field(description="Stable agent key used by the frontend.")
    label: str = Field(description="Human-readable agent label.")
    status: AgentConnectionStatus = Field(description="Current workflow status label.")


class WorkflowBranchItem(BaseModel):
    """Branch lineage metadata for one stored workflow run."""

    branch_type: WorkflowBranchType = Field(
        description="Whether this run is the initial workflow execution or a follow-up rerun."
    )
    parent_run_id: str | None = Field(
        default=None,
        description="Previous run id when this run was created from a follow-up rerun.",
    )
    root_run_id: str = Field(description="First run id in the current rerun branch chain.")
    branch_depth: int = Field(description="Zero-based rerun depth from the root workflow run.")
    trigger_message: str | None = Field(
        default=None,
        description="Follow-up natural-language instruction that created this rerun.",
    )
    child_run_ids: list[str] = Field(
        default_factory=list,
        description="Direct child reruns created from this run.",
    )


class TimelineEventItem(BaseModel):
    """One recorded timeline event derived from a workflow run."""

    event_id: str = Field(description="Stable event id inside one workflow run.")
    agent_key: str | None = Field(default=None, description="Agent responsible for the event.")
    title: str = Field(description="Short event title.")
    detail: str = Field(description="Human-readable event detail.")
    status: AgentConnectionStatus = Field(description="Timeline event status.")
    created_at: str = Field(description="UTC timestamp attached to the event.")


class AnalysisSummaryItem(BaseModel):
    """Compact analysis summary shown in the reports screen."""

    symbol: str = Field(description="Symbol represented by this summary line.")
    total_score: float = Field(description="Analysis total score from 0 to 1.")
    summary: str = Field(description="Short analysis summary for the frontend.")


class WorkflowRunListItem(BaseModel):
    """Compact run item for history and report lists."""

    run_id: str = Field(description="Stored workflow run id.")
    created_at: str = Field(description="UTC timestamp when the run was stored.")
    symbols: list[str] = Field(description="Requested symbols for the run.")
    objective: str = Field(description="Main agent objective used for the run.")
    summary: str = Field(description="Main agent summary for the run.")
    branch: WorkflowBranchItem = Field(description="Rerun lineage metadata for this workflow run.")
    report_approved_count: int = Field(description="Number of report-approved symbols.")
    report_count: int = Field(description="Total number of generated reports.")
    decision_actions: dict[str, TradeAction] = Field(
        description="Final decision action keyed by symbol."
    )


class WorkflowRunDetailResponse(BaseModel):
    """Persisted workflow run detail used by history and reports pages."""

    run_id: str = Field(description="Stored workflow run id.")
    created_at: str = Field(description="UTC timestamp when the run was stored.")
    branch: WorkflowBranchItem = Field(description="Rerun lineage metadata for this workflow run.")
    agent_statuses: list[AgentStatusItem] = Field(
        description="Per-agent health and completion status."
    )
    timeline: list[TimelineEventItem] = Field(
        description="Derived timeline for the autonomous workflow steps."
    )
    analysis_summaries: list[AnalysisSummaryItem] = Field(
        description="Low-priority compact summaries for repeated analysis refreshes."
    )
    result: DecisionResponse = Field(description="Full stored workflow response.")
