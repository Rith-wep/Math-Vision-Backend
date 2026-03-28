import { Router } from "express";

import { formulaRoutes } from "./formulaRoutes.js";
import { adminRoutes } from "./adminRoutes.js";
import { quizRoutes } from "./quizRoutes.js";
import { handwritingRoutes } from "./handwritingRoutes.js";
import { scanRoutes } from "./scanRoutes.js";
import { solverRoutes } from "./solverRoutes.js";
import { ttsRoutes } from "./ttsRoutes.js";
import { userDashboardRoutes } from "./userDashboardRoutes.js";

export const apiRouter = Router();

apiRouter.use("/formulas", formulaRoutes);
apiRouter.use("/", adminRoutes);
apiRouter.use("/", quizRoutes);
apiRouter.use("/handwriting", handwritingRoutes);
apiRouter.use("/scan", scanRoutes);
apiRouter.use("/solve", solverRoutes);
apiRouter.use("/tts", ttsRoutes);
apiRouter.use("/user", userDashboardRoutes);
