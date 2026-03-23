import { Router } from "express";

import { synthesizeKhmerSpeech } from "../controllers/ttsController.js";

export const ttsRoutes = Router();

// Convert Khmer explanation text into backend-generated audio.
ttsRoutes.post("/", synthesizeKhmerSpeech);
