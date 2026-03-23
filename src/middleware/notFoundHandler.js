/**
 * Handles unknown routes before they reach the error handler.
 */
export const notFoundHandler = (request, response) => {
  response.status(404).json({
    message: "Route not found."
  });
};
