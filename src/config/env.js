import dotenv from "dotenv";
dotenv.config();

const required = ["PORT", "MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET", "REDIS_HOST", "REDIS_PORT", "CLIENT_URL"];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
});

export const env = {
  port: process.env.PORT,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  redisHost: process.env.REDIS_HOST,
  redisPort: parseInt(process.env.REDIS_PORT),
  clientUrl: process.env.CLIENT_URL,
};
