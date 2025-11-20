import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import mongoose from "mongoose";

export const sendMessage = async (payload) => {
  const { conversationId, senderId, type, text, fileUrl, metadata } = payload;

  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Conversation not found");

  // check membership for private/group
  const member = conv.members.find((m) => m.userId.toString() === senderId.toString());
  if (!member) throw new Error("Not a member of conversation");

  const msg = new Message({
    conversationId,
    sender: senderId,
    type,
    text: text || null,
    fileUrl: fileUrl || null,
    metadata: metadata || {},
    replyTo: replyToId || null,
  });

  await msg.save();

  // update conversation lastMessage
  conv.lastMessage = msg._id;
  conv.updatedAt = new Date();
  await conv.save();

  // populate sender minimal
  (await msg.populate("sender", "_id username displayName avatarUrl").execPopulate?.()) ||
    (await msg.populate("sender", "_id username displayName avatarUrl"));

  await msg.populate("sender", "_id username displayName avatarUrl");
  if (replyToId) {
    await msg.populate("replyTo");
  }

  return msg;
};

export const getMessages = async ({ conversationId, limit = 20, cursor = null }) => {
  const query = { conversationId: new mongoose.Types.ObjectId(conversationId) };
  if (cursor) {
    // find message by id to obtain createdAt
    const cursorMsg = await Message.findById(cursor).select("createdAt");
    if (cursorMsg) {
      query.createdAt = { $lt: cursorMsg.createdAt };
    }
  }
  const msgs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "_id username displayName avatarUrl");
  return msgs;
};

export const markAsSeen = async ({ conversationId, userId, lastSeenMessageId }) => {
  const filter = {
    conversationId: new mongoose.Types.ObjectId(conversationId),
    _id: { $lte: new mongoose.Types.ObjectId(lastSeenMessageId) },
    seenBy: { $ne: new mongoose.Types.ObjectId(userId) },
  };

  const res = await Message.updateMany(filter, { $addToSet: { seenBy: userId } });
  return res;
};

export const editMessage = async ({ messageId, editorId, newText }) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error("Message not found");
  if (msg.sender.toString() !== editorId.toString()) throw new Error("Not authorized to edit");
  msg.text = newText;
  msg.edited = true;
  await msg.save();
  return msg;
};

export const deleteMessage = async ({ messageId, actorId }) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error("Message not found");
  // allow actor if sender or group admin? For simplicity: allow sender or conversation admin
  const conv = await Conversation.findById(msg.conversationId);
  const actorMember = conv.members.find((m) => m.userId.toString() === actorId.toString());
  const canDelete = msg.sender.toString() === actorId.toString() || (actorMember && actorMember.role === "admin");
  if (!canDelete) throw new Error("Not authorized to delete message");
  // soft delete: mark type to 'text' + text null + deleted flag OR set text to null and set metadata
  msg.text = null;
  msg.fileUrl = null;
  msg.metadata = msg.metadata || {};
  msg.metadata.deleted = true;
  msg.deleted = true;
  await msg.save();
  return msg;
};

export const recallMessage = async ({ messageId, actorId }) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error("Message not found");

  // Chỉ người gửi mới được thu hồi
  if (msg.sender.toString() !== actorId.toString()) {
    throw new Error("Not authorized to recall this message");
  }

  // (Tuỳ chọn) Kiểm tra thời gian: Chỉ cho thu hồi trong vòng 1 giờ
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - new Date(msg.createdAt).getTime() > ONE_HOUR) {
    throw new Error("Message is too old to recall");
  }

  // Đánh dấu thu hồi và xóa nội dung
  msg.isRecalled = true;
  msg.text = null; // Xóa nội dung text
  msg.fileUrl = null; // Xóa file nếu có
  msg.metadata = {}; // Xóa metadata

  await msg.save();
  return msg;
};
