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
