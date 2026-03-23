/**
 * Handles unknown routes before they reach the error handler.
 */
export const notFoundHandler = (request, response) => {
  response.status(404).json({
    message: "រកមិនឃើញទំព័រ ឬសេវាកម្មដែលបានស្នើទេ។"
  });
};
