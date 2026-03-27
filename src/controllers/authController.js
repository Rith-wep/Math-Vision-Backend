import { env } from "../config/env.js";
import { authService } from "../services/authService.js";

const resolveFrontendCallbackBaseUrl = (request) => {
  const requestedCallback = typeof request.query.state === "string" ? request.query.state.trim() : "";

  if (!requestedCallback) {
    return env.frontendAuthCallbackUrl;
  }

  try {
    const parsedUrl = new URL(requestedCallback);

    if (env.clientOrigins.includes(parsedUrl.origin)) {
      return parsedUrl.toString();
    }
  } catch {
    // Fall back to the default configured callback URL.
  }

  return env.frontendAuthCallbackUrl;
};

const buildFrontendCallbackUrl = (request, { token, user, error }) => {
  const callbackUrl = new URL(resolveFrontendCallbackBaseUrl(request));

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
    response.redirect(buildFrontendCallbackUrl(request, { token, user }));
  },

  googleFailure(request, response) {
    response.redirect(buildFrontendCallbackUrl(request, { error: "google_oauth_failed" }));
  },

  getCurrentUser(request, response) {
    const { token, user } = authService.buildAuthResponse(request.user);

    response.status(200).json({
      token,
      user
    });
  },

  async updateProfile(request, response, next) {
    try {
      const updatedUser = await authService.updateProfile(request.user._id, request.body);
      const { token, user } = authService.buildAuthResponse(updatedUser);

      response.status(200).json({
        token,
        user
      });
    } catch (error) {
      next(error);
    }
  },

  logout(request, response) {
    response.status(200).json({
      message: "Logged out successfully."
    });
  }
};
