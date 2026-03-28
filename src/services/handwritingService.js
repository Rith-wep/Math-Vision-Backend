import { AppError } from "../utils/AppError.js";
import { solverService } from "./solverService.js";

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const extractCleanBase64 = (imageData) => {
  if (!imageData?.trim()) {
    throw new AppError("Image data is missing.", 400);
  }

  const cleanedBase64 = imageData.replace(/^data:[^;]+;base64,/, "").trim();

  if (!cleanedBase64) {
    throw new AppError("Image data is missing.", 400);
  }

  if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanedBase64)) {
    throw new AppError("Image data is not valid base64.", 400);
  }

  return cleanedBase64;
};

const normalizeRecognizedMath = (value = "") =>
  value
    .replace(/[−–—]/g, "-")
    .replace(/[×✕✖]/g, "\\times ")
    .replace(/[÷]/g, "\\div ")
    .replace(/[π]/g, "\\pi ")
    .replace(/[θ]/g, "\\theta ")
    .replace(/[Δ]/g, "\\Delta ")
    .replace(/[∞]/g, "\\infty ")
    .replace(/[∑]/g, "\\sum ")
    .replace(/[∫]/g, "\\int ")
    .replace(/[√]\s*\(?([A-Za-z0-9]+)/g, "\\sqrt{$1}")
    .replace(/\s+/g, " ")
    .trim();

class HandwritingService {
  async recognize({ imageData, mimeType = "image/png" }) {
    if (!imageData?.trim()) {
      throw new AppError("Image data is missing.", 400);
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new AppError("Unsupported image format. Please use JPG, PNG, or WEBP.", 400);
    }

    const cleanedBase64 = extractCleanBase64(imageData);
    const extractedText = await solverService.extractQuestionTextFromImage(cleanedBase64, mimeType);
    const normalizedExpression = normalizeRecognizedMath(extractedText);

    if (!normalizedExpression) {
      throw new AppError("No readable math text was detected in the handwriting input.", 422);
    }

    return {
      text: extractedText,
      latex: normalizedExpression,
      expression: normalizedExpression,
      provider: "gemini_handwriting"
    };
  }
}

export const handwritingService = new HandwritingService();
