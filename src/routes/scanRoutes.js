import { Router } from "express";

import { scanMathImage } from "../controllers/scanController.js";
import { attachOptionalAuth } from "../middleware/optionalAuthMiddleware.js";
import { imageUpload } from "../middleware/uploadMiddleware.js";

export const scanRoutes = Router();

// Upload an image, extract math text, and solve it.
scanRoutes.post("/", attachOptionalAuth, imageUpload.single("image"), scanMathImage);
