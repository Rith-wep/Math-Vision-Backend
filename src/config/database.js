import mongoose from "mongoose";

import { env } from "./env.js";

/**
 * Opens the MongoDB connection used by the application.
 */
export const connectDatabase = async () => {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB");
};
