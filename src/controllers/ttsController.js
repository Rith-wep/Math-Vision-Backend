import { ttsService } from "../services/ttsService.js";

/**
 * Converts Khmer explanation text into MP3 audio for the solution page.
 */
export const synthesizeKhmerSpeech = async (request, response, next) => {
  try {
    const audioBuffer = await ttsService.synthesizeKhmerSpeech(request.body.text);

    response.setHeader("Content-Type", "audio/mpeg");
    response.setHeader("Content-Length", audioBuffer.length);
    response.status(200).send(audioBuffer);
  } catch (error) {
    next(error);
  }
};
