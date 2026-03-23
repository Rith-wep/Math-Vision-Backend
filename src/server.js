import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

/**
 * Starts the API server after the database connection is ready.
 */
const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(env.port, () => {
      console.log(`Backend server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start backend server.", error);
    process.exit(1);
  }
};

startServer();
