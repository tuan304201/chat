import { redis } from "../config/redis.js";

const WINDOW_MS = 5000; // 5 seconds
const MAX_CALLS = 10;

export default async function rateLimitMiddleware(packet, next) {
  try {
    // packet is [eventName, payload, ack?]
    const socket = this; // bound to socket by socket.io
    const key = `rl:${socket.id}:${Math.floor(Date.now() / WINDOW_MS)}`;
    const calls = await redis.incr(key);
    if (calls === 1) {
      await redis.pexpire(key, WINDOW_MS);
    }
    if (calls > MAX_CALLS) {
      const err = new Error("Rate limit exceeded");
      err.data = { retryAfter: WINDOW_MS / 1000 };
      return next(err);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
