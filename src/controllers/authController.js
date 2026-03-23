import { env } from "../config/env.js";
import { authService } from "../services/authService.js";

const buildFrontendCallbackUrl = ({ token, user, error }) => {
  const callbackUrl = new URL(env.frontendAuthCallbackUrl);

  if (token) {
    callbackUrl.searchParams.set("token", token);
  }

  if (user) {
    callbackUrl.searchParams.set("user", JSON.stringify(user));
  }

  if (error) {
    callbackUrl.searchParams.set("error", error);
  }

  return callbackUrl.toString();
};

export const authController = {
  async register(request, response, next) {
    try {
      const user = await authService.registerWithEmail(request.body);
      const { token, user: safeUser } = authService.buildAuthResponse(user);

      response.status(201).json({
        token,
        user: safeUser
      });
    } catch (error) {
      next(error);
    }
  },

  async login(request, response, next) {
    try {
      const user = await authService.loginWithEmail(request.body);
      const { token, user: safeUser } = authService.buildAuthResponse(user);

      response.status(200).json({
        token,
        user: safeUser
      });
    } catch (error) {
      next(error);
    }
  },

  googleCallback(request, response) {
    const { token, user } = authService.buildAuthResponse(request.user);
    response.redirect(buildFrontendCallbackUrl({ token, user }));
  },

  googleFailure(request, response) {
    response.redirect(buildFrontendCallbackUrl({ error: "google_oauth_failed" }));
  },

  getCurrentUser(request, response) {
    const { token, user } = authService.buildAuthResponse(request.user);

    response.status(200).json({
      token,
      user
    });
  },

  logout(request, response) {
    response.status(200).json({
      message: "Logged out successfully."
    });
  }
};
