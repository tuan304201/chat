import FriendRequest from "../models/FriendRequest.js";
import Friendship from "../models/Friendship.js";
import User from "../models/User.js";

export const sendRequest = async ({ fromId, toId }) => {
  if (fromId === toId) throw new Error("Cannot send request to yourself");

  const toUser = await User.findById(toId);
  if (!toUser) throw new Error("Target user not found");

  // check existing friendship
  const existingFriend = await Friendship.findOne({ userId: fromId, friendId: toId });
  if (existingFriend) throw new Error("Already friends");

  // upsert friend request (unique index prevents duplicates)
  try {
    const req = new FriendRequest({ from: fromId, to: toId });
    await req.save();
    return req;
  } catch (err) {
    // duplicate key or other
    if (err.code === 11000) {
      const existing = await FriendRequest.findOne({ from: fromId, to: toId });
      if (existing.status === "pending") throw new Error("Friend request already sent");
      if (existing.status === "declined") {
        // we may allow re-sending by updating status
        existing.status = "pending";
        await existing.save();
        return existing;
      }
    }
    throw err;
  }
};

export const acceptRequest = async ({ requestId, acceptorId }) => {
  const req = await FriendRequest.findById(requestId);
  if (!req) throw new Error("Friend request not found");
  if (req.to.toString() !== acceptorId.toString()) throw new Error("Not authorized to accept");

  if (req.status === "accepted") return req;

  // Cập nhật trạng thái request
  req.status = "accepted";
  await req.save();

  // Tạo quan hệ bạn bè 2 chiều (Không dùng transaction nữa)
  try {
    await Friendship.create([
      { userId: req.from, friendId: req.to },
      { userId: req.to, friendId: req.from },
    ]);
    return req;
  } catch (err) {
    // Nếu lỗi khi tạo bạn bè, ta nên revert lại status (thủ công)
    req.status = "pending";
    await req.save();
    throw err;
  }
};

export const declineRequest = async ({ requestId, declinerId }) => {
  const req = await FriendRequest.findById(requestId);
  if (!req) throw new Error("Friend request not found");
  if (req.to.toString() !== declinerId.toString()) throw new Error("Not authorized to decline");
  req.status = "declined";
  await req.save();
  return req;
};

export const cancelRequest = async ({ requestId, senderId }) => {
  const req = await FriendRequest.findById(requestId);
  if (!req) throw new Error("Friend request not found");
  if (req.from.toString() !== senderId.toString()) throw new Error("Not authorized");
  await req.deleteOne();
  return true;
};

export const listRequests = async (userId) => {
  const incoming = await FriendRequest.find({ to: userId, status: "pending" }).populate(
    "from",
    "_id username displayName avatarUrl",
  );
  const outgoing = await FriendRequest.find({ from: userId, status: "pending" }).populate(
    "to",
    "_id username displayName avatarUrl",
  );
  return { incoming, outgoing };
};

export const removeFriend = async ({ userId, friendId }) => {
  await Friendship.deleteMany({
    $or: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
  });
  return true;
};
