import dotenv from "dotenv";

dotenv.config();

/**
 * Central place for environment variables so the rest of the app
 * reads from one clean object instead of process.env everywhere.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  frontendAuthCallbackUrl:
    process.env.FRONTEND_AUTH_CALLBACK_URL || "http://localhost:5173/auth/callback",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/khmer_math_solver",
  jwtSecret: process.env.JWT_SECRET || "development_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
  googleCloudTtsCredentialsJson: process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON || "",
  googleCloudVisionCredentialsJson:
    process.env.GOOGLE_CLOUD_VISION_CREDENTIALS_JSON ||
    process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON ||
    "",
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || ""
};
