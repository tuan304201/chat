import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "30d";

export const signAccessToken = (payload) => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_EXPIRES });
};

export const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: REFRESH_EXPIRES });
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (err) {
    const e = new Error("Invalid access token");
    e.code = "INVALID_TOKEN";
    throw e;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.jwtRefreshSecret);
  } catch (err) {
    const e = new Error("Invalid refresh token");
    e.code = "INVALID_TOKEN";
    throw e;
  }
};
