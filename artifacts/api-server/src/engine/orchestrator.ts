import { runWorkflowGraph } from "./workflow-graph";
import type { InvestmentRequest, WorkflowResult } from "./schemas";

export async function runWorkflow(request: InvestmentRequest): Promise<WorkflowResult> {
  return runWorkflowGraph(request);
}
