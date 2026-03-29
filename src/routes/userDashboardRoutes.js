import { Router } from "express";

import {
  deleteUserHistoryItem,
  getDashboardStats,
  getSolveAccessStatus,
  getUserHistory
} from "../controllers/userDashboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const userDashboardRoutes = Router();

userDashboardRoutes.get("/dashboard-stats", requireAuth, getDashboardStats);
userDashboardRoutes.get("/solve-access", requireAuth, getSolveAccessStatus);
userDashboardRoutes.get("/history", requireAuth, getUserHistory);
userDashboardRoutes.delete("/history/:historyItemId", requireAuth, deleteUserHistoryItem);
