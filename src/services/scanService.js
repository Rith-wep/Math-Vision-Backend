import vision from "@google-cloud/vision";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { solverService } from "./solverService.js";
import { userDashboardService } from "./userDashboardService.js";

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  } catch {
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

const normalizeOcrTextToLatex = (text) =>
  text
    .replace(/[–—]/g, "-")
    .replace(/[×]/g, "\\times ")
    .replace(/[÷]/g, "\\div ")
    .replace(/[π]/g, "\\pi ")
    .replace(/[Δ]/g, "\\Delta ")
    .replace(/√\s*\(?([A-Za-z0-9]+)/g, "\\sqrt{$1}")
    .replace(/([A-Za-z0-9])²/g, "$1^{2}")
    .replace(/([A-Za-z0-9])³/g, "$1^{3}")
    .replace(/\s+/g, " ")
    .trim();

const extractTextFromVisionResult = (result) =>
  result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";

const buildImageBuffer = (imageBase64) => {
  if (!imageBase64?.trim()) {
    throw new AppError("Image data is missing.", 400);
  }

  const cleanedBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();

  if (!cleanedBase64) {
    throw new AppError("Image data is missing.", 400);
  }

  if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanedBase64)) {
    throw new AppError("Image data is not valid base64.", 400);
  }

  return Buffer.from(cleanedBase64, "base64");
};

class ScanService {
  async runVisionOcr(imageBuffer) {
    const client = getVisionClient();
    const [result] = await client.documentTextDetection({
      image: {
        content: imageBuffer
      }
    });

    const rawText = extractTextFromVisionResult(result).trim();

    if (!rawText) {
      throw new AppError("No readable math text was detected in the image.", 422);
    }

    return {
      rawText,
      expression: normalizeOcrTextToLatex(rawText)
    };
  }

  async solveImageBase64(imageBase64, mimeType = "image/jpeg", userId = null) {
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new AppError("Unsupported image format. Please use JPG, PNG, or WEBP.", 400);
    }

    try {
      const imageBuffer = buildImageBuffer(imageBase64);
      const { rawText, expression } = await this.runVisionOcr(imageBuffer);
      const cachedSolution = userId
        ? await userDashboardService.findCachedSolution(userId, expression)
        : null;
      const solution = cachedSolution || (await solverService.solveExpression(expression));

      return {
        ...solution,
        raw_text: rawText,
        extracted_via: "google_vision"
      };
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.statusCode === 400 || error.statusCode === 422)
      ) {
        throw error;
      }

      return solverService.solveImageBase64(imageBase64, mimeType);
    }
  }
}

export const scanService = new ScanService();
