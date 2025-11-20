import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

export default async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Unauthorized socket: No token"));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error("Unauthorized socket: Invalid token"));
    }

    const user = await User.findById(payload.userId).select("-password");
    if (!user) {
      return next(new Error("Unauthorized socket: User not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
