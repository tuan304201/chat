import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

export const createApp = () => {
  const app = express();

  // --- Security Middlewares ---
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan("dev"));

  // Static files (uploads)
  app.use("/uploads", express.static("uploads"));

  // --- API Routes ---
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/uploads", uploadRoutes);

  // --- Error Handling ---
  app.use(errorHandler);

  return app;
};
