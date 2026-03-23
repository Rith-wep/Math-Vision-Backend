import { solverService } from "../services/solverService.js";
import { userDashboardService } from "../services/userDashboardService.js";

/**
 * Solves a math expression and returns Khmer step-by-step reasoning.
 */
export const solveExpression = async (request, response, next) => {
  try {
    const expression = request.body.expression?.trim?.() || "";
    const imageBase64 = request.body.imageBase64?.trim?.() || "";
    const mimeType = request.body.mimeType?.trim?.() || "image/jpeg";
    const questionText = expression;
    let result = null;
    let servedFromCache = false;

    if (request.user?._id && questionText) {
      result = await userDashboardService.findCachedSolution(request.user._id, questionText);
      servedFromCache = Boolean(result);
    }

    if (!result) {
      result = imageBase64
        ? await solverService.solveImageBase64(imageBase64, mimeType)
        : await solverService.solveExpression(expression);
    }

    if (request.user?._id && !servedFromCache) {
      await userDashboardService.recordSolvedProblem(request.user._id, {
        questionText: result.question_text || questionText,
        solution: result
      });
    }

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
