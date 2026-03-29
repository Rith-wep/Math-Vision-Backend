import { solverService } from "../services/solverService.js";
import { userDashboardService } from "../services/userDashboardService.js";
import { AppError } from "../utils/AppError.js";

const buildAnswerOnlySolution = (result = {}) => ({
  ...result,
  complexity: "answer_only",
  overview_title: "Answer Only",
  overview_description: "This free solve was returned without steps.",
  steps: [],
  summary: "",
  explanation: "",
  isAnswerOnly: true
});

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
    let solveAccess = null;

    if (request.user?._id && request.user?.role !== "admin") {
      solveAccess = await userDashboardService.getSolveAccessMode(request.user._id);

      if (solveAccess.mode === "blocked") {
        throw new AppError("Limit reached: Upgrade to Pro to continue solving today.", 403);
      }
    }

    if (request.user?._id && questionText) {
      result = await userDashboardService.findCachedSolution(request.user._id, questionText);
      servedFromCache = Boolean(result);
    }

    if (!result) {
      result = imageBase64
        ? await solverService.solveImageBase64(imageBase64, mimeType)
        : await solverService.solveExpression(expression);
    }

    if (solveAccess?.mode === "answer_only") {
      result = buildAnswerOnlySolution(result);
    }

    if (request.user?._id) {
      await userDashboardService.recordSolvedProblem(request.user._id, {
        questionText: result.question_text || questionText,
        solution: result,
        accessMode: solveAccess?.mode === "answer_only" ? "answer_only" : "full"
      });
    }

    response.status(200).json({
      ...result,
      solveAccess: solveAccess?.summary || null,
      servedFromCache
    });
  } catch (error) {
    next(error);
  }
};
