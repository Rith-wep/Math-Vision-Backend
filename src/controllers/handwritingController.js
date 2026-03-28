import { handwritingService } from "../services/handwritingService.js";

export const recognizeHandwriting = async (request, response, next) => {
  try {
    const imageData = request.body.imageData?.trim?.() || "";
    const mimeType = request.body.mimeType?.trim?.() || "image/png";
    const result = await handwritingService.recognize({ imageData, mimeType });

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
