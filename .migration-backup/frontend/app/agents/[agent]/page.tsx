import { notFound } from "next/navigation";

import { AgentWorkspace } from "../../../components/agent-workspace";
import { agentDefinitions, type AgentKey } from "../../../lib/workspace";

export function generateStaticParams() {
  return agentDefinitions.map((agent) => ({ agent: agent.key }));
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agent: AgentKey }>;
}) {
  const { agent } = await params;
  const valid = agentDefinitions.some((item) => item.key === agent);
  if (!valid) {
    notFound();
  }

  return <AgentWorkspace agentKey={agent} />;
}
