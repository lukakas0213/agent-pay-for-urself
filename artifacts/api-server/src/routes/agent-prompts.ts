import { Router, type IRouter } from "express";
import {
  agentKeys,
  getPromptCatalog,
  getStoredPrompt,
  setStoredPrompt,
} from "../lib/agent-prompts-store";

const router: IRouter = Router();
const defaultPrompts = getPromptCatalog();

router.get("/agent-prompts", (_req, res) => {
  const items = agentKeys.map((key) => {
    const user = getStoredPrompt(key);
    const def = defaultPrompts[key];
    return {
      agent_key: key,
      label: def.label,
      prompt: user?.prompt ?? def.prompt,
      updated_at: user?.updated_at ?? new Date().toISOString(),
      source: user ? "user" : "default",
    };
  });
  res.json(items);
});

router.put("/agent-prompts/:agent_key", (req, res) => {
  const key = req.params.agent_key as keyof typeof defaultPrompts;
  if (!agentKeys.includes(key)) {
    res.status(404).json({ error: "에이전트 키를 찾을 수 없습니다." });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const item = setStoredPrompt(key, prompt);
  const def = defaultPrompts[key];

  res.json({
    item: {
      agent_key: key,
      label: def.label,
      prompt,
      updated_at: item.updated_at,
      source: "user",
    },
  });
});

export default router;
