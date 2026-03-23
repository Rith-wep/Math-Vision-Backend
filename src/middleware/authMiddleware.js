import { authService } from "../services/authService.js";
import { AppError } from "../utils/AppError.js";

export const requireAuth = async (request, response, next) => {
  try {
    const authorizationHeader = request.headers.authorization || "";
    const token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
      : "";

    if (!token) {
      throw new AppError("Authentication token is required.", 401);
    }

    const user = await authService.verifyToken(token);
    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
