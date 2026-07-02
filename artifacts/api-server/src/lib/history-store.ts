import type { WorkflowResult } from "../engine/schemas";

const store: WorkflowResult[] = [];

export function addWorkflowRun(result: WorkflowResult): void {
  store.unshift(result);
}

export function listWorkflowRuns(): WorkflowResult[] {
  return store;
}

export function getWorkflowRun(runId: string): WorkflowResult | undefined {
  return store.find((r) => r.run_id === runId);
}
