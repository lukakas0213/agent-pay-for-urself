import { runWorkflowGraph } from "./workflow-graph";
import type { InvestmentRequest, WorkflowResult } from "./schemas";

export function runWorkflow(request: InvestmentRequest): WorkflowResult {
  return runWorkflowGraph(request);
}
