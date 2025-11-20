import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js"; // [Cite: Import env từ config]

export default async function authMiddleware(req, res, next) {
  try {
    // Lấy token từ cookie hoặc header
    const token = req.cookies?.accessToken || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No token provided",
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid token",
      });
    }

    const user = await User.findById(payload.sub || payload.userId).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
