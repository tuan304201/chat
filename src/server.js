import http from "http";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import initSocketServer from "./socket/index.js";
import { env } from "./config/env.js";

const startServer = async () => {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // SocketIO
  const io = initSocketServer(server);
  app.set("io", io);

  server.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
};

startServer();
