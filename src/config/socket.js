import { Server } from "socket.io";
import { env } from "./env.js";
import { redis } from "./redis.js";

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });

  // --- Middleware xác thực socket ---
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing token"));

    // Check token trong redis
    const userId = await redis.get(`socket_token:${token}`);
    if (!userId) return next(new Error("Invalid token"));

    socket.userId = userId;
    next();
  });

  // --- Xử lý kết nối ---
  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // Lưu socketID theo user
    await redis.sadd(`user_sockets:${userId}`, socket.id);

    // Đánh dấu online
    await redis.set(`user_online:${userId}`, 1);
    io.emit("user:online", userId);

    console.log(`User connected: ${userId}`);

    // --- Khi disconnect ---
    socket.on("disconnect", async () => {
      await redis.srem(`user_sockets:${userId}`, socket.id);

      const sockets = await redis.smembers(`user_sockets:${userId}`);
      if (sockets.length === 0) {
        await redis.del(`user_online:${userId}`);
        await redis.set(`user_lastSeen:${userId}`, Date.now());
        io.emit("user:offline", userId);
      }

      console.log(`User disconnected: ${userId}`);
    });
  });

  return io;
};
