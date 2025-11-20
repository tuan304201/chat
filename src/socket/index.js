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
    const userId = socket.user.id;

    // store socket id in redis set for this user
    await redis.sadd(`user_sockets:${userId}`, socketId);
    // mark online flag
    await redis.set(`user_online:${userId}`, "1");
    // publish online event to all servers via adapter (use io.emit keeps in cluster)
    io.emit("user:online", { userId });

    // attach a simple rate limiter per socket
    socket.use(rateLimitMiddleware);

    // Create rooms for user's personal channel (for direct push, e.g., presence)
    const personalRoom = `user:${userId}`;
    socket.join(personalRoom);

    // register handlers
    chatHandler(io, socket);
    groupHandler(io, socket);
    presenceHandler(io, socket);

    socket.on("disconnect", async (reason) => {
      // remove socket id
      await redis.srem(`user_sockets:${userId}`, socketId);

      const remaining = await redis.scard(`user_sockets:${userId}`);
      if (!remaining) {
        await redis.del(`user_online:${userId}`);
        await redis.set(`user_lastSeen:${userId}`, Date.now());
        io.emit("user:offline", { userId });
      }
    });
  });

  return io;
}
