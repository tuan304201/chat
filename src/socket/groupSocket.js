import * as convoService from "../services/conversationService.js";

export default function groupHandler(io, socket) {
  const userId = socket.user.id;

  socket.on("group:addMember", async ({ conversationId, userId: newMemberId }, cb) => {
    try {
      const conv = await convoService.addMember({ conversationId, actorId: userId, newMemberId });
      // notify members in the group
      io.to(`conv:${conversationId}`).emit("group:memberAdded", { conversationId, user: newMemberId });
      if (cb) cb({ success: true, conversation: conv });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });

  socket.on("group:removeMember", async ({ conversationId, userId: targetMemberId }, cb) => {
    try {
      const conv = await convoService.removeMember({ conversationId, actorId: userId, targetMemberId });
      io.to(`conv:${conversationId}`).emit("group:memberRemoved", { conversationId, userId: targetMemberId });
      if (cb) cb({ success: true, conversation: conv });
    } catch (err) {
      if (cb) cb({ success: false, message: err.message });
    }
  });
}
