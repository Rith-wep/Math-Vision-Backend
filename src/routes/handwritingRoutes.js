import { Router } from "express";

import { recognizeHandwriting } from "../controllers/handwritingController.js";
import { attachOptionalAuth } from "../middleware/optionalAuthMiddleware.js";

export const handwritingRoutes = Router();

handwritingRoutes.post("/recognize", attachOptionalAuth, recognizeHandwriting);
