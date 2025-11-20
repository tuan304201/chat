import { redis } from "../config/redis.js";

export default function presenceHandler(io, socket) {
  socket.on("presence:check", async ({ userIds }, cb) => {
    try {
      if (!Array.isArray(userIds)) userIds = [userIds];
      const pipeline = redis.pipeline();
      userIds.forEach((id) => {
        pipeline.get(`user_online:${id}`);
        pipeline.get(`user_lastSeen:${id}`);
      });
      const results = await pipeline.exec();
      const res = {};
      for (let i = 0; i < userIds.length; i++) {
        const online = results[i * 2][1]; // get result
        const lastSeen = results[i * 2 + 1][1];
        res[userIds[i]] = { online: !!online, lastSeen: lastSeen ? new Date(Number(lastSeen)) : null };
      }
      if (cb) cb({ success: true, presence: res });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });
}
