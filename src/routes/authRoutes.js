import { Router } from "express";

import { isGoogleAuthConfigured, passport } from "../config/passport.js";
import { authController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/AppError.js";

export const authRoutes = Router();

const ensureGoogleAuthConfigured = (request, response, next) => {
  if (!isGoogleAuthConfigured) {
    next(new AppError("Google OAuth is not configured on the server.", 503));
    return;
  }

  next();
};

authRoutes.get(
  "/google",
  ensureGoogleAuthConfigured,
  (request, response, next) =>
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      state: typeof request.query.frontend_callback === "string" ? request.query.frontend_callback : ""
    })(request, response, next)
);

authRoutes.post("/register", authController.register);
authRoutes.post("/signup", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.get(
  "/google/callback",
  ensureGoogleAuthConfigured,
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/google/failure"
  }),
  authController.googleCallback
);

authRoutes.get("/google/failure", authController.googleFailure);
authRoutes.get("/me", requireAuth, authController.getCurrentUser);
authRoutes.patch("/profile", requireAuth, authController.updateProfile);
authRoutes.get("/logout", authController.logout);
