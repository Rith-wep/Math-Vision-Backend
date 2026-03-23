import { Router } from "express";

import {
  deleteUserHistoryItem,
  getDashboardStats,
  getUserHistory
} from "../controllers/userDashboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const userDashboardRoutes = Router();

userDashboardRoutes.get("/dashboard-stats", requireAuth, getDashboardStats);
userDashboardRoutes.get("/history", requireAuth, getUserHistory);
userDashboardRoutes.delete("/history/:historyItemId", requireAuth, deleteUserHistoryItem);
