import cors from "cors";
import express from "express";
import morgan from "morgan";

import { env } from "./config/env.js";
import { passport } from "./config/passport.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { authRoutes } from "./routes/authRoutes.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.get("/api/health", (request, response) => {
  response.status(200).json({
    message: "Khmer Math Solver API is running."
  });
});

app.use("/auth", authRoutes);
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
