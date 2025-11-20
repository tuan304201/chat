import * as messageService from "../services/messageService.js";
import * as convoService from "../services/conversationService.js";

export default function chatHandler(io, socket) {
  const userId = socket.user.id;

  socket.on("conversation:join", async ({ conversationId }, cb) => {
    try {
      const conv = await convoService.getConversationById(conversationId, userId);
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

      // emit to room (all sockets joined to conv)
      io.to(`conv:${payload.conversationId}`).emit("message:new", msg);

      // ack to sender
      if (cb) cb({ success: true, message: msg });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("message:recall", async ({ messageId }, cb) => {
    try {
      // Gọi service recall
      const recalledMsg = await messageService.recallMessage({ messageId, actorId: userId });

      // Báo cho tất cả mọi người trong phòng chat biết tin nhắn này đã bị thu hồi
      // Client sẽ nhận được messageId và cập nhật UI thành "Tin nhắn đã thu hồi"
      io.to(`conv:${recalledMsg.conversationId}`).emit("message:recalled", {
        messageId,
        conversationId: recalledMsg.conversationId,
      });

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
      io.to(`conv:${updated.conversationId}`).emit("message:updated", updated);
      if (cb) cb({ success: true, message: updated });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("message:delete", async ({ messageId }, cb) => {
    try {
      const deleted = await messageService.deleteMessage({ messageId, actorId: userId });
      io.to(`conv:${deleted.conversationId}`).emit("message:deleted", deleted);
      if (cb) cb({ success: true, message: deleted });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });
}
