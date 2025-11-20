import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.mongoUri);

    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    console.log("Retrying in 5s...");
    setTimeout(connectDB, 5000);
  }
};
