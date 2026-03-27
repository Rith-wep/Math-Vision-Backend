import { AppError } from "../utils/AppError.js";

export const requireAdmin = (request, response, next) => {
  if (request.user?.role !== "admin") {
    next(new AppError("Admin access is required.", 403));
    return;
  }

  next();
};
