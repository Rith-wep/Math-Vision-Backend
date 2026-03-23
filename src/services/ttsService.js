import textToSpeech from "@google-cloud/text-to-speech";

import { env } from "../config/env.js";

let ttsClient = null;

const getTtsClient = () => {
  if (ttsClient) {
    return ttsClient;
  }

  if (!env.googleCloudTtsCredentialsJson) {
    throw new Error(
      "Google Cloud TTS credentials are missing. Set GOOGLE_CLOUD_TTS_CREDENTIALS_JSON in backend/.env."
    );
  }

  let credentials;

  try {
    credentials = JSON.parse(env.googleCloudTtsCredentialsJson);
  } catch (error) {
    throw new Error(
      "GOOGLE_CLOUD_TTS_CREDENTIALS_JSON is not valid JSON. Paste the full service-account JSON on one line."
    );
  }

  ttsClient = new textToSpeech.TextToSpeechClient({
    projectId: env.googleCloudProjectId || credentials.project_id,
    credentials
  });

  return ttsClient;
};

/**
 * Generates Khmer speech audio from explanation text so the frontend
 * does not depend on browser-installed speech voices.
 */
class TtsService {
  async synthesizeKhmerSpeech(text) {
    const normalizedText = text?.trim();

    if (!normalizedText) {
      const error = new Error("Khmer explanation text is required.");
      error.statusCode = 400;
      throw error;
    }

    const client = getTtsClient();
    const [result] = await client.synthesizeSpeech({
      input: { text: normalizedText },
      voice: {
        languageCode: "km-KH",
        ssmlGender: "FEMALE"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.92
      }
    });

    if (!result.audioContent) {
      throw new Error("Google Cloud TTS returned an empty audio response.");
    }

    return Buffer.isBuffer(result.audioContent)
      ? result.audioContent
      : Buffer.from(result.audioContent, "base64");
  }
}

export const ttsService = new TtsService();
