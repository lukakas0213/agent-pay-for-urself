import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { WorkflowResult } from "../engine/schemas";
import { getExperimentStorePath } from "./runtime-config";

export interface ExperimentRecord {
  experiment_id: string;
  run_id: string;
  name: string;
  description: string;
  created_at: string;
  symbols: string[];
  decision_actions: Record<string, string>;
  runtime: unknown | null;
  result: unknown;
  decision: {
    symbols: string[];
    max_position_weight: number;
    mandate: unknown | null;
  };
  prompt_overrides: Record<string, string>;
}

export function buildExperimentRecord(
  result: WorkflowResult,
  options: {
    name?: string;
    description?: string;
  } = {},
): ExperimentRecord {
  const decisionActions: Record<string, string> = {};
  for (const decision of result.decisions ?? []) {
    decisionActions[decision.symbol] = decision.action;
  }

  const symbolsLabel = result.symbols.join(", ");
  const name = options.name?.trim() || `${symbolsLabel} 자동 저장 보고서`;
  const description =
    options.description?.trim() ||
    result.supervisor_directive.summary ||
    result.feedback.summary ||
    result.user_prompt ||
    "";

  return {
    experiment_id: `exp-${Date.now()}`,
    run_id: result.run_id,
    name,
    description,
    created_at: new Date().toISOString(),
    symbols: result.symbols,
    decision_actions: decisionActions,
    runtime: result.runtime ?? null,
    result,
    decision: {
      symbols: result.symbols,
      max_position_weight: result.mandate.max_position_weight,
      mandate: result.mandate,
    },
    prompt_overrides: {},
  };
}

class ExperimentStore {
  private cache: ExperimentRecord[] | null = null;

  constructor(private readonly path: string) {}

  list(): ExperimentRecord[] {
    return this.loadAll();
  }

  get(experimentId: string): ExperimentRecord | undefined {
    return this.loadAll().find((item) => item.experiment_id === experimentId);
  }

  save(record: ExperimentRecord): ExperimentRecord {
    const next = this.loadAll().filter((item) => item.experiment_id !== record.experiment_id);
    next.unshift(record);
    this.writeAll(next);
    return record;
  }

  private loadAll(): ExperimentRecord[] {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const raw = readFileSync(this.path, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.cache = parsed.filter((item): item is ExperimentRecord => {
          return Boolean(item && typeof item === "object" && typeof item.experiment_id === "string");
        });
      } else {
        this.cache = [];
      }
    } catch {
      this.cache = [];
    }

    return this.cache;
  }

  private writeAll(records: ExperimentRecord[]): void {
    this.cache = records;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

export const experimentStore = new ExperimentStore(getExperimentStorePath());

export function saveWorkflowResultAsExperiment(
  result: WorkflowResult,
  options: {
    name?: string;
    description?: string;
  } = {},
): ExperimentRecord {
  const record = buildExperimentRecord(result, options);
  experimentStore.save(record);
  return record;
}
