/**
 * Small custom error class that lets us attach HTTP status codes.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}
