export const START = "__start__" as const;
export const END = "__end__" as const;

type GraphNodeName = string;
type NodeHandler<State> = (state: State) => State;
type ConditionalHandler<State> = (state: State) => GraphNodeName;

export class StateGraph<State> {
  private nodes = new Map<GraphNodeName, NodeHandler<State>>();
  private edges = new Map<GraphNodeName, GraphNodeName[]>();
  private conditionals = new Map<GraphNodeName, ConditionalHandler<State>>();

  addNode(name: GraphNodeName, handler: NodeHandler<State>) {
    this.nodes.set(name, handler);
    return this;
  }

  addEdge(from: GraphNodeName, to: GraphNodeName) {
    const current = this.edges.get(from) ?? [];
    current.push(to);
    this.edges.set(from, current);
    return this;
  }

  addConditionalEdges(from: GraphNodeName, handler: ConditionalHandler<State>) {
    this.conditionals.set(from, handler);
    return this;
  }

  compile(options?: { maxSteps?: number }) {
    const nodes = this.nodes;
    const edges = this.edges;
    const conditionals = this.conditionals;
    const maxSteps = options?.maxSteps ?? 100;

    return {
      invoke(initialState: State): State {
        let state = initialState;
        let current = (edges.get(START) ?? [])[0];
        let steps = 0;

        while (current && current !== END) {
          steps += 1;
          if (steps > maxSteps) {
            throw new Error(`graph exceeded max steps: ${maxSteps}`);
          }

          const node = nodes.get(current);
          if (!node) {
            throw new Error(`graph node not found: ${current}`);
          }

          state = node(state);

          const conditional = conditionals.get(current);
          if (conditional) {
            current = conditional(state);
            continue;
          }

          const next = edges.get(current) ?? [];
          if (next.length > 1) {
            throw new Error(`graph node has multiple linear edges; use addConditionalEdges: ${current}`);
          }
          current = next[0] ?? END;
        }

        return state;
      },
    };
  }
}
