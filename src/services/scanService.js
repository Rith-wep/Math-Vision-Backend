import vision from "@google-cloud/vision";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { solverService } from "./solverService.js";
import { userDashboardService } from "./userDashboardService.js";

let visionClient = null;

const getVisionClient = () => {
  if (visionClient) {
    return visionClient;
  }

  if (!env.googleCloudVisionCredentialsJson) {
    throw new AppError(
      "Google Cloud Vision credentials are missing. Set GOOGLE_CLOUD_VISION_CREDENTIALS_JSON in backend/.env.",
      500
    );
  }

  let credentials;

  try {
    credentials = JSON.parse(env.googleCloudVisionCredentialsJson);
  } catch (error) {
    throw new AppError(
      "GOOGLE_CLOUD_VISION_CREDENTIALS_JSON is not valid JSON. Paste the full service-account JSON on one line.",
      500
    );
  }

  visionClient = new vision.ImageAnnotatorClient({
    projectId: env.googleCloudProjectId || credentials.project_id,
    credentials
  });

  return visionClient;
};

const normalizeOcrTextToLatex = (text) => {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[×x]/g, (match) => (match === "x" ? "x" : "\\times "))
    .replace(/÷/g, "\\div ")
    .replace(/π/g, "\\pi ")
    .replace(/√\s*\(?([A-Za-z0-9]+)/g, "\\sqrt{$1}")
    .replace(/([A-Za-z0-9])²/g, "$1^{2}")
    .replace(/([A-Za-z0-9])³/g, "$1^{3}")
    .replace(/Δ/g, "\\Delta ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Reads math text from an uploaded image, normalizes it toward LaTeX,
 * and solves it through the existing math engine.
 */
class ScanService {
  async scanAndSolve(imageBuffer, userId = null) {
    if (!imageBuffer) {
      throw new AppError("Image file is required for scanning.", 400);
    }

    const client = getVisionClient();
    const [result] = await client.documentTextDetection({
      image: {
        content: imageBuffer
      }
    });

    const rawText =
      result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";

    if (!rawText.trim()) {
      throw new AppError("No readable math text was detected in the image.", 422);
    }

    const expression = normalizeOcrTextToLatex(rawText);
    const cachedSolution = await userDashboardService.findCachedSolution(userId, expression);
    const solution = cachedSolution || (await solverService.solveExpression(expression));

    return {
      expression,
      raw_text: rawText.trim(),
      solution,
      servedFromCache: Boolean(cachedSolution)
    };
  }
}

export const scanService = new ScanService();
