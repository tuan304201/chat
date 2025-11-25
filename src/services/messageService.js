import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Friendship from "../models/Friendship.js";
import mongoose from "mongoose";

export const sendMessage = async (payload) => {
  const { conversationId, senderId, type, text, fileUrl, metadata, replyToId } = payload;

  const conv = await Conversation.findById(conversationId);

  if (conv.isDisbanded) {
    throw new Error("Nhóm đã bị giải tán, không thể gửi tin nhắn.");
  }

  if (!conv) throw new Error("Conversation not found");

  // check membership for private/group
  const member = conv.members.find((m) => m.userId.toString() === senderId.toString());
  if (!member) throw new Error("Not a member of conversation");

  if (member.leftAt) {
    throw new Error("Bạn không còn là thành viên của nhóm này, không thể gửi tin nhắn.");
  }

  if (conv.type === "private") {
    // Tìm người nhận (người kia trong hội thoại)
    const receiver = conv.members.find((m) => m.userId.toString() !== senderId.toString());

    if (receiver) {
      const isFriend = await checkFriendship(senderId, receiver.userId);

      if (!isFriend) {
        // Nếu chưa kết bạn: Đếm số tin nhắn sender đã gửi trong cuộc hội thoại này
        const sentCount = await Message.countDocuments({
          conversationId,
          sender: senderId,
        });

        // Nếu đã gửi 1 tin rồi thì chặn
        if (sentCount >= 1) {
          throw new Error("Bạn cần kết bạn để gửi thêm tin nhắn");
        }
      }
    }
  }

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

  conv.lastMessage = msg._id;

  conv.lastAction = {
    type: "message",
    text: type === "text" ? text : `[${type}]`,
    sender: senderId,
    createdAt: new Date(),
  };

  // update conversation lastMessage
  conv.updatedAt = new Date();
  await conv.save();

  // populate sender minimal
  (await msg.populate("sender", "_id username displayName avatarUrl").execPopulate?.()) ||
    (await msg.populate("sender", "_id username displayName avatarUrl"));

  if (replyToId) {
    await msg.populate({
      path: "replyTo",
      select: "text fileUrl type isRecalled sender",
      populate: {
        path: "sender",
        select: "_id username displayName avatarUrl",
      },
    });
  }

  return msg;
};

export const getMessages = async ({ conversationId, currentUserId, limit = 20, cursor = null }) => {
  // 1. Lấy thông tin hội thoại để biết deletedAt của user
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Conversation not found");

  const member = conv.members.find((m) => m.userId.toString() === currentUserId.toString());
  if (!member) throw new Error("Not authorized");

  const deletedAt = member.deletedAt || new Date(0);

  const maxDate = member.leftAt ? new Date(member.leftAt) : new Date();

  const query = {
    conversationId: new mongoose.Types.ObjectId(conversationId),
    deletedBy: { $ne: new mongoose.Types.ObjectId(currentUserId) },
    createdAt: { $gt: deletedAt, $lte: maxDate }, // --- THÊM ĐIỀU KIỆN NÀY ---
  };

  if (cursor) {
    const cursorMsg = await Message.findById(cursor).select("createdAt");
    if (cursorMsg) {
      query.createdAt = { ...query.createdAt, $lt: cursorMsg.createdAt };
    }
  }

  const msgs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "_id username displayName avatarUrl")
    .populate("reactions.userId", "_id username displayName avatarUrl")
    .populate({
      path: "replyTo",
      select: "text fileUrl type isRecalled sender",
      populate: { path: "sender", select: "_id displayName" },
    });

  return msgs;
};

export const markAsSeen = async ({ conversationId, userId, lastSeenMessageId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) return;

  if (conv.type === "private") {
    const otherMember = conv.members.find((m) => m.userId.toString() !== userId.toString());
    if (otherMember) {
      const isFriend = await checkFriendship(userId, otherMember.userId);
      if (!isFriend) return { skipped: true, reason: "Not friends" };
    }
  }

  const filter = {
    conversationId: new mongoose.Types.ObjectId(conversationId),
    _id: { $lte: new mongoose.Types.ObjectId(lastSeenMessageId) },
    seenBy: { $ne: new mongoose.Types.ObjectId(userId) },
  };
  await Message.updateMany(filter, { $addToSet: { seenBy: userId } });

  // [MỚI] Cập nhật lastViewedAt VÀ Reset hasUnseenReaction
  await Conversation.updateOne(
    { _id: conversationId, "members.userId": userId },
    {
      $set: {
        "members.$.lastViewedAt": new Date(),
        "members.$.hasUnseenReaction": false, // Đã xem -> Xóa cờ notification reaction
      },
    },
  );

  return true;
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

  if (!msg.deletedBy.includes(actorId)) {
    msg.deletedBy.push(actorId);
    await msg.save();
  }

  return msg;
};

export const recallMessage = async ({ messageId, actorId }) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error("Message not found");

  if (msg.sender.toString() !== actorId.toString()) {
    throw new Error("Not authorized to recall this message");
  }

  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - new Date(msg.createdAt).getTime() > ONE_HOUR) {
    throw new Error("Message is too old to recall");
  }

  msg.isRecalled = true;
  msg.text = null;
  msg.fileUrl = null;
  msg.metadata = {};

  await msg.save();

  await Conversation.findOneAndUpdate(
    { _id: msg.conversationId, lastMessage: msg._id },
    {
      lastAction: {
        type: "recall",
        text: "Tin nhắn đã thu hồi",
        sender: actorId,
        createdAt: new Date(),
      },
      updatedAt: new Date(),
    },
  );

  return msg;
};

export const reactToMessage = async ({ messageId, userId, emoji }) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error("Message not found");

  const existingIndex = msg.reactions.findIndex((r) => r.userId.toString() === userId.toString());
  if (existingIndex > -1) {
    if (msg.reactions[existingIndex].emoji === emoji) {
      msg.reactions.splice(existingIndex, 1);
    } else {
      msg.reactions[existingIndex].emoji = emoji;
    }
  } else {
    msg.reactions.push({ userId, emoji });
  }

  await msg.save();

  await msg.populate("reactions.userId", "_id username displayName avatarUrl");

  let shouldNotify = false;

  // Nếu người thả KHÔNG phải người gửi tin nhắn -> Tạo thông báo
  if (msg.sender.toString() !== userId.toString()) {
    shouldNotify = true;

    // [MỚI] Cập nhật lastAction VÀ Bật cờ hasUnseenReaction cho người khác
    await Conversation.updateOne(
      { _id: msg.conversationId },
      {
        // 1. Cập nhật lastAction hiển thị
        lastAction: {
          type: "reaction",
          text: `Đã thả cảm xúc ${emoji} vào tin nhắn`,
          sender: userId,
          createdAt: new Date(),
        },
        updatedAt: new Date(),

        // 2. Bật cờ cho tất cả thành viên KHÁC người thả
        $set: { "members.$[elem].hasUnseenReaction": true },
      },
      {
        // Filter: Chỉ update cho member nào KHÔNG phải là userId (người thả)
        arrayFilters: [{ "elem.userId": { $ne: userId } }],
      },
    );
  }

  return { msg, shouldNotify };
};

const checkFriendship = async (userId1, userId2) => {
  const friend = await Friendship.findOne({
    $or: [
      { userId: userId1, friendId: userId2 },
      { userId: userId2, friendId: userId1 },
    ],
  });
  return !!friend;
};
