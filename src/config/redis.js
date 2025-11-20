import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis({
  host: env.redisHost,
  port: env.redisPort,
  retryStrategy(times) {
    console.log("Redis reconnecting...");
    return Math.min(times * 50, 2000);
  },
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});
