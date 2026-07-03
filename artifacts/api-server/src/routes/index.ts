import { Router, type IRouter } from "express";
import healthRouter from "./health";
import decisionsRouter from "./decisions";
import agentPromptsRouter from "./agent-prompts";
import accountRouter from "./account";
import experimentsRouter from "./experiments";
import consoleRouter from "./console";
import historyRouter from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(decisionsRouter);
router.use(agentPromptsRouter);
router.use(accountRouter);
router.use(experimentsRouter);
router.use(consoleRouter);
router.use(historyRouter);

export default router;
