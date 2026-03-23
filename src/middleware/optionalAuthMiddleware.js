import { authService } from "../services/authService.js";

export const attachOptionalAuth = async (request, response, next) => {
  try {
    const authorizationHeader = request.headers.authorization || "";
    const token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
      : "";

    if (!token) {
      next();
      return;
    }

    const user = await authService.verifyToken(token);
    request.user = user;
    next();
  } catch (error) {
    next();
  }
};
