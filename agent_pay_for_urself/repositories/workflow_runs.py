"""Workflow result repository boundary.

The default repository is in-memory only. It gives the API a stable contract
for console follow-up interactions without claiming durable persistence yet.
"""

from abc import ABC, abstractmethod
from uuid import uuid4

from agent_pay_for_urself.schemas import WorkflowResult


class WorkflowRunRepository(ABC):
    """Stores and retrieves workflow results by run id."""

    @abstractmethod
    def save(self, result: WorkflowResult) -> str:
        """Persist one workflow result and return its run identifier."""

    @abstractmethod
    def get(self, run_id: str) -> WorkflowResult | None:
        """Return the stored workflow result or None when it is missing."""


class InMemoryWorkflowRunRepository(WorkflowRunRepository):
    """Repository used by the current API process without durable storage."""

    def __init__(self) -> None:
        self._results: dict[str, WorkflowResult] = {}

    def save(self, result: WorkflowResult) -> str:
        run_id = uuid4().hex
        self._results[run_id] = result
        return run_id

    def get(self, run_id: str) -> WorkflowResult | None:
        return self._results.get(run_id)
