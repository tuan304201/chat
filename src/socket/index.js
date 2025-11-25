import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "../config/redis.js";
import { verifyAccessToken } from "../utils/jwt.js";
import chatHandler from "./chatSocket.js";
import groupHandler from "./groupSocket.js";
import presenceHandler from "./presenceSocket.js";
import rateLimitMiddleware from "./rateLimitSocket.js";

export default function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    pingTimeout: 30000,
    maxHttpBufferSize: 1e6, // 1 MB default, adjust if needed
  });

  // Redis adapter - requires @socket.io/redis-adapter
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // --- Socket middleware: verify JWT access token from handshake ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Authentication error: token missing"));

      const payload = verifyAccessToken(token); // throws if invalid
      socket.user = {
        id: payload.sub,
        username: payload.username,
      };
      return next();
    } catch (err) {
      return next(new Error("Authentication error: " + err.message));
    }
  });

  io.on("connection", async (socket) => {
    const { id: socketId } = socket;
    const userId = socket.user.id; // userId từ middleware

    // Lưu socket id
    await redis.sadd(`user_sockets:${userId}`, socketId);
    // Đánh dấu online
    await redis.set(`user_online:${userId}`, "1");

    // Emit online cho mọi người
    io.emit("user:online", { userId });

    socket.use(rateLimitMiddleware);

    const personalRoom = `user:${userId}`;
    socket.join(personalRoom);

    chatHandler(io, socket);
    groupHandler(io, socket);
    presenceHandler(io, socket);

    socket.on("disconnect", async (reason) => {
      console.log(`User disconnected: ${userId} (Socket: ${socketId}) - Reason: ${reason}`);

      // 1. Xóa socket id hiện tại khỏi set
      await redis.srem(`user_sockets:${userId}`, socketId);

      // 2. Kiểm tra xem còn socket nào khác không
      const remaining = await redis.scard(`user_sockets:${userId}`);

      // Debug log để kiểm tra
      console.log(`Remaining sockets for user ${userId}: ${remaining}`);

      // 3. Nếu không còn socket nào -> Offline thật sự
      if (remaining <= 0) {
        // Xóa cờ online
        await redis.del(`user_online:${userId}`);

        // Cập nhật lastSeen
        const lastSeen = Date.now();
        await redis.set(`user_lastSeen:${userId}`, lastSeen);

        // Broadcast sự kiện offline cho toàn bộ hệ thống
        io.emit("user:offline", { userId, lastSeen });
        console.log(`>>> User ${userId} is now OFFLINE`);
      }
    });
  });

  return io;
}
