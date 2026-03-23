import { Router } from "express";

import { solveExpression } from "../controllers/solverController.js";
import { attachOptionalAuth } from "../middleware/optionalAuthMiddleware.js";

export const solverRoutes = Router();

// Solve a user-submitted math expression.
solverRoutes.post("/", attachOptionalAuth, solveExpression);
