import User from "../models/User.js";
import Friendship from "../models/Friendship.js";
import { redis } from "../config/redis.js";

export const getById = async (id) => {
  const user = await User.findById(id).select("_id username displayName avatarUrl bio lastSeen createdAt");
  if (!user) throw new Error("User not found");
  return user;
};

export const searchByUsername = async (q, currentUserId, { limit = 20 } = {}) => {
  if (!q) return [];
  const regex = new RegExp(q.trim(), "i");

  const users = await User.find({
    username: regex,
    _id: { $ne: currentUserId },
  })
    .limit(limit)
    .select("_id username displayName avatarUrl");

  return users;
};

export const updateProfile = async (userId, { displayName, avatarUrl, bio }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (displayName) user.displayName = displayName;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (bio !== undefined) user.bio = bio;
  await user.save();
  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  };
};

export const setLastSeen = async (userId, date = new Date()) => {
  await User.findByIdAndUpdate(userId, { lastSeen: date }, { new: true }).exec();
  // optionally cache in redis
  await redis.set(`user_lastSeen:${userId}`, date.getTime());
};

export const getFriends = async (userId) => {
  const relations = await Friendship.find({ userId }).populate("friendId", "_id username displayName avatarUrl");
  return relations.map((r) => r.friendId);
};
