import * as messageService from "../services/messageService.js";
import * as convoService from "../services/conversationService.js";
import Conversation from "../models/Conversation.js";

export default function chatHandler(io, socket) {
  const userId = socket.user.id;

  socket.on("conversation:join", async ({ conversationId }, cb) => {
    try {
      const conv = await convoService.getConversationById(conversationId, userId);
      const amIMember = conv.members.find((m) => (m.userId._id || m.userId).toString() === userId);
      if (!amIMember) {
        if (cb) cb({ success: false, message: "Bạn không còn là thành viên" });
        return;
      }
      socket.join(`conv:${conversationId}`);
      if (cb) cb({ success: true, conversationId });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("conversation:leave", async ({ conversationId }, cb) => {
    try {
      socket.leave(`conv:${conversationId}`);
      if (cb) cb({ success: true });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("message:send", async (payload, cb) => {
    try {
      const msg = await messageService.sendMessage({
        conversationId: payload.conversationId,
        senderId: userId,
        type: payload.type,
        text: payload.text,
        fileUrl: payload.fileUrl,
        metadata: payload.metadata,
        replyToId: payload.replyToId,
      });

      // 1. Gửi cho những người đang mở hội thoại này (đã join room)
      io.to(`conv:${payload.conversationId}`).emit("message:new", msg);

      // 2. [FIX REALTIME] Gửi thông báo update cho TẤT CẢ thành viên trong hội thoại
      // Để người chưa mở chat (như người nhận tin nhắn đầu tiên) cũng nhận được
      const conv = await Conversation.findById(payload.conversationId);
      if (conv) {
        conv.members.forEach((member) => {
          // Gửi sự kiện vào room cá nhân của từng user ("user:ID")
          // Frontend sẽ lắng nghe event này để update danh sách chat và push tin nhắn
          io.to(`user:${member.userId}`).emit("conversation:update", {
            conversationId: conv._id,
            lastMessage: msg,
            updatedAt: conv.updatedAt,
          });
        });
      }

      if (cb) cb({ success: true, message: msg });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("message:recall", async ({ messageId }, cb) => {
    try {
      const recalledMsg = await messageService.recallMessage({ messageId, actorId: userId });

      // 1. Gửi cho room chat (người đang xem)
      io.to(`conv:${recalledMsg.conversationId}`).emit("message:recalled", {
        messageId,
        conversationId: recalledMsg.conversationId,
      });

      // 2. [THÊM] Gửi thông báo Sidebar cho tất cả thành viên
      const conv = await Conversation.findById(recalledMsg.conversationId);
      if (conv) {
        conv.members.forEach((member) => {
          io.to(`user:${member.userId}`).emit("conversation:recall_notify", {
            conversationId: recalledMsg.conversationId,
            messageId: messageId,
            updatedAt: new Date(),
          });
        });
      }

      if (cb) cb({ success: true });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("typing", ({ conversationId, isTyping }) => {
    // broadcast to others in the conversation room that this user is typing
    socket.to(`conv:${conversationId}`).emit("typing", { conversationId, userId, isTyping });
  });

  socket.on("message:seen", async ({ conversationId, lastSeenMessageId }, cb) => {
    try {
      await messageService.markAsSeen({ conversationId, userId, lastSeenMessageId });
      // broadcast seen update to room
      io.to(`conv:${conversationId}`).emit("seen:update", { conversationId, userId, lastSeenMessageId });
      if (cb) cb({ success: true });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  // optional: event to edit/delete message realtime
  socket.on("message:edit", async ({ messageId, newText }, cb) => {
    try {
      const updated = await messageService.editMessage({ messageId, editorId: userId, newText });

      // THÊM DÒNG NÀY: Báo cho cả room biết tin nhắn đã update
      io.to(`conv:${updated.conversationId}`).emit("message:updated", updated);

      if (cb) cb({ success: true, message: updated });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("message:delete", async ({ messageId }, cb) => {
    try {
      const deleted = await messageService.deleteMessage({ messageId, actorId: userId });
      if (cb) cb({ success: true, message: deleted });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("message:react", async ({ messageId, emoji }, cb) => {
    try {
      // Nhận kết quả từ service
      const { msg, shouldNotify } = await messageService.reactToMessage({ messageId, userId, emoji });

      // 1. Luôn gửi cập nhật UI bên trong đoạn chat (cho tất cả mọi người đang xem)
      io.to(`conv:${msg.conversationId}`).emit("message:reaction_updated", {
        messageId,
        reactions: msg.reactions,
        conversationId: msg.conversationId,
      });

      // 2. [FIX] Chỉ gửi thông báo Sidebar nếu shouldNotify = true
      if (shouldNotify) {
        const conv = await Conversation.findById(msg.conversationId);
        if (conv) {
          conv.members.forEach((member) => {
            // Chỉ báo cho người nhận (không báo cho người vừa thả - dù logic service đã lọc, check thêm cho chắc)
            if (member.userId.toString() !== userId.toString()) {
              io.to(`user:${member.userId}`).emit("conversation:reaction_notify", {
                conversationId: msg.conversationId,
                reactorId: userId,
                emoji: emoji,
                updatedAt: conv.updatedAt,
              });
            }
          });
        }
      }

      if (cb) cb({ success: true });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });
}
