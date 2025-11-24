import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";

export const register = async ({ username, password, displayName, avatarUrl }) => {
  // Validate cơ bản
  if (!username || !password || !displayName) {
    throw new Error("Vui lòng điền đầy đủ thông tin");
  }

  const existing = await User.findOne({ username: username.toLowerCase().trim() });
  if (existing) throw new Error("Tên đăng nhập đã tồn tại");

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const user = new User({
    username: username.toLowerCase().trim(),
    password: hashed,
    displayName,
    avatarUrl: avatarUrl || null,
  });

  await user.save();

  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
};

export const login = async ({ username, password }) => {
  if (!username || !password) throw new Error("Missing username or password");

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Invalid credentials");

  const payload = { sub: user._id.toString(), username: user.username };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // store refresh token in redis with uuid reference for revocation
  const refreshId = uuidv4();
  await redis.setex(`refresh:${refreshId}`, 30 * 24 * 3600, refreshToken);
  // return refreshId instead of raw token to be safer on client? We'll return raw token for simplicity
  return {
    accessToken,
    refreshToken,
    user: { id: user._id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
  };
};

export const refreshTokens = async ({ refreshToken }) => {
  if (!refreshToken) throw new Error("Missing refresh token");

  const payload = verifyRefreshToken(refreshToken);

  const isRevoked = await redis.get(`revoked_refresh:${refreshToken}`);
  if (isRevoked) {
    throw new Error("Refresh token has been revoked");
  }

  const newAccess = signAccessToken({ sub: payload.sub, username: payload.username });
  const newRefresh = signRefreshToken({ sub: payload.sub, username: payload.username });

  return { accessToken: newAccess, refreshToken: newRefresh };
};

export const revokeRefreshToken = async ({ refreshToken }) => {
  if (!refreshToken) throw new Error("Missing refresh token");
  // simple approach: add to blacklist with expiry equal to token expiry
  try {
    const payload = verifyRefreshToken(refreshToken);
    const ttl = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.setex(`revoked_refresh:${refreshToken}`, ttl, "revoked");
    }
    return true;
  } catch (err) {
    // token invalid — still ok
    return true;
  }
};
