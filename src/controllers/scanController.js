import { scanService } from "../services/scanService.js";
import { userDashboardService } from "../services/userDashboardService.js";

/**
 * Extracts math text from an uploaded image and returns the solved result.
 */
export const scanMathImage = async (request, response, next) => {
  try {
    const result = await scanService.scanAndSolve(request.file?.buffer, request.user?._id);

    if (request.user?._id && !result.servedFromCache) {
      await userDashboardService.recordSolvedProblem(request.user._id, {
        questionText: result.expression,
        solution: result.solution || null
      });
    }

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
