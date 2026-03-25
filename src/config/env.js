import dotenv from "dotenv";

dotenv.config();

const isDevelopment = (process.env.NODE_ENV || "development") === "development";

const getEnvValue = (key, developmentFallback = "") => {
  const value = process.env[key];

  if (value) {
    return value;
  }

  if (isDevelopment) {
    return developmentFallback;
  }

  return "";
};

const parseClientOrigins = () => {
  const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultDevelopmentOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];

  return Array.from(
    new Set([
      ...configuredOrigins,
      ...(isDevelopment ? defaultDevelopmentOrigins : [])
    ])
  );
};

/**
 * Central place for environment variables so the rest of the app
 * reads from one clean object instead of process.env everywhere.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: getEnvValue("CLIENT_URL", "http://localhost:5173"),
  clientOrigins: parseClientOrigins(),
  frontendAuthCallbackUrl: getEnvValue(
    "FRONTEND_AUTH_CALLBACK_URL",
    "http://localhost:5173/auth/callback"
  ),
  mongoUri: getEnvValue("MONGODB_URI", "mongodb://localhost:27017/khmer_math_solver"),
  jwtSecret: getEnvValue("JWT_SECRET", "development_secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  geminiApiKey: getEnvValue("GEMINI_API_KEY"),
  googleClientId: getEnvValue("GOOGLE_CLIENT_ID"),
  googleClientSecret: getEnvValue("GOOGLE_CLIENT_SECRET"),
  googleCallbackUrl: getEnvValue("GOOGLE_CALLBACK_URL", "http://localhost:5000/auth/google/callback"),
  googleCloudTtsCredentialsJson: getEnvValue("GOOGLE_CLOUD_TTS_CREDENTIALS_JSON"),
  googleCloudVisionCredentialsJson:
    getEnvValue("GOOGLE_CLOUD_VISION_CREDENTIALS_JSON")
    || getEnvValue("GOOGLE_CLOUD_TTS_CREDENTIALS_JSON"),
  googleCloudProjectId: getEnvValue("GOOGLE_CLOUD_PROJECT_ID")
};

if (!isDevelopment) {
  const requiredProductionEnvKeys = [
    "CLIENT_URL",
    "MONGODB_URI",
    "JWT_SECRET",
    "GEMINI_API_KEY"
  ];

  const missingKeys = requiredProductionEnvKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missingKeys.join(", ")}`
    );
  }
}
