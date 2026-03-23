/**
 * Sends a consistent JSON error response to the client.
 */
import { getKhmerErrorMessage } from "../utils/errorMessages.js";

export const errorHandler = (error, request, response, next) => {
  const statusCode = error.statusCode || 500;

  response.status(statusCode).json({
    message: getKhmerErrorMessage(error.message || "Internal server error.")
  });
};
