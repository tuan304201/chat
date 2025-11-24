import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

export const createPrivateConversation = async ({ userAId, userBId }) => {
  if (!userAId || !userBId) throw new Error("Missing participant ids");
  if (userAId.toString() === userBId.toString()) throw new Error("Cannot create conversation with yourself");

  // 1. Tìm cuộc trò chuyện đã tồn tại
  let conv = await Conversation.findOne({
    type: "private",
    "members.userId": { $all: [new mongoose.Types.ObjectId(userAId), new mongoose.Types.ObjectId(userBId)] },
    $expr: { $eq: [{ $size: "$members" }, 2] },
  });

  // 2. Nếu đã tồn tại -> Populate thông tin User rồi trả về
  if (conv) {
    await conv.populate("members.userId", "_id username displayName avatarUrl");
    return conv;
  }

  // 3. Nếu chưa tồn tại -> Tạo mới
  const newConv = new Conversation({
    type: "private",
    members: [{ userId: userAId }, { userId: userBId }],
  });

  await newConv.save();

  // 4. QUAN TRỌNG: Populate thông tin User cho cuộc trò chuyện mới
  await newConv.populate("members.userId", "_id username displayName avatarUrl");

  return newConv;
};

export const createGroup = async ({ ownerId, title, memberIds = [] }) => {
  if (!ownerId) throw new Error("Missing owner id");
  const members = [
    { userId: ownerId, role: "admin" },
    ...memberIds.filter((id) => id.toString() !== ownerId.toString()).map((id) => ({ userId: id })),
  ];

  const conv = new Conversation({
    type: "group",
    title: title || "New group",
    members,
    inviteCode: uuidv4(),
  });

  await conv.save();
  return conv;
};

export const addMember = async ({ conversationId, actorId, newMemberId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Conversation not found");
  if (conv.type !== "group") throw new Error("Not a group conversation");

  // check actor permission (admin)
  const actor = conv.members.find((m) => m.userId.toString() === actorId.toString());
  if (!actor || (actor.role !== "admin" && actor.role !== "owner")) throw new Error("Not authorized");

  const exists = conv.members.some((m) => m.userId.toString() === newMemberId.toString());
  if (exists) throw new Error("User already a member");

  conv.members.push({ userId: newMemberId });
  await conv.save();
  return conv;
};

export const removeMember = async ({ conversationId, actorId, targetMemberId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Conversation not found");
  if (conv.type !== "group") throw new Error("Not a group conversation");

  const actor = conv.members.find((m) => m.userId.toString() === actorId.toString());
  if (!actor || (actor.role !== "admin" && actor.role !== "owner")) throw new Error("Not authorized");

  conv.members = conv.members.filter((m) => m.userId.toString() !== targetMemberId.toString());
  await conv.save();
  return conv;
};

export const getConversationsForUser = async (userId, { limit = 30, skip = 0 } = {}) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const convs = await Conversation.find({
    "members.userId": userId,
    $or: [{ type: "group" }, { lastMessage: { $ne: null } }],
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "lastMessage", select: "text fileUrl type createdAt sender isRecalled seenBy" })
    .populate("members.userId", "_id username displayName avatarUrl")
    .populate("lastAction.sender", "_id username displayName");

  const results = await Promise.all(
    convs.map(async (conv) => {
      const convObj = conv.toObject();

      const currentMember = convObj.members.find((m) => m.userId._id.toString() === userId.toString());
      const lastViewedAt = currentMember?.lastViewedAt || new Date(0);
      // [MỚI] Lấy trạng thái cờ reaction
      const hasUnseenReaction = currentMember?.hasUnseenReaction || false;

      // 1. Logic hiển thị Preview (Giữ nguyên)
      let previewDisplay = convObj.lastMessage;
      if (convObj.lastAction && new Date(convObj.lastAction.createdAt) > new Date(convObj.lastMessage?.createdAt)) {
        if (convObj.lastAction.sender?._id.toString() !== userId.toString()) {
          previewDisplay = {
            ...convObj.lastMessage,
            text: convObj.lastAction.text,
            sender: convObj.lastAction.sender,
            createdAt: convObj.lastAction.createdAt,
            type: "action",
          };
        }
      }
      convObj.lastMessage = previewDisplay;

      // 2. [MỚI] LOGIC TÍNH TỔNG UNREAD COUNT

      // Đếm số tin nhắn mới
      const unreadMsgCount = await Message.countDocuments({
        conversationId: conv._id,
        createdAt: { $gt: lastViewedAt },
        sender: { $ne: userObjectId },
      });

      // Tính tổng: Tin nhắn mới + 1 (nếu có reaction chưa xem)
      // Lưu ý: Reaction luôn chỉ tính là 1 notification dù có bao nhiêu reaction đi nữa (giống logic Zalo/FB)
      convObj.unreadCount = unreadMsgCount + (hasUnseenReaction ? 1 : 0);

      return convObj;
    }),
  );

  return results;
};

export const getConversationById = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId)
    .populate("members.userId", "_id username displayName avatarUrl")
    .populate({
      path: "lastMessage",
      select: "text fileUrl type isRecalled sender createdAt",
    });

  if (!conv) throw new Error("Conversation not found");

  const member = conv.members.find((m) => m.userId._id.toString() === userId.toString());
  if (!member) throw new Error("Not authorized to view conversation");

  return conv;
};

export const joinByInviteCode = async ({ inviteCode, userId }) => {
  const conv = await Conversation.findOne({ inviteCode });
  if (!conv) throw new Error("Invite link invalid");
  if (conv.type !== "group") throw new Error("Invite is not for a group");
  const exists = conv.members.some((m) => m.userId.toString() === userId.toString());
  if (exists) return conv;
  conv.members.push({ userId });
  await conv.save();
  return conv;
};
