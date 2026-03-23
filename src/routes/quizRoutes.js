import { Router } from "express";

import { quizController } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const quizRoutes = Router();

quizRoutes.get("/subjects", requireAuth, quizController.getSubjects);
quizRoutes.get("/subjects/:id/levels", requireAuth, quizController.getSubjectLevels);
quizRoutes.get("/questions/:subjectId/:levelId", requireAuth, quizController.getQuestions);
quizRoutes.post(
  "/questions/:subjectId/:levelId/complete",
  requireAuth,
  quizController.completeLevel
);
