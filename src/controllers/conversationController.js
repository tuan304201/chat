import * as convoService from "../services/conversationService.js";
import { redis } from "../config/redis.js";

export const createPrivate = async (req, res, next) => {
  try {
    const conv = await convoService.createPrivateConversation({
      userAId: req.user.id,
      userBId: req.body.userId,
    });
    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (req, res, next) => {
  try {
    const conv = await convoService.createGroup({
      ownerId: req.user.id,
      title: req.body.title,
      avatar: req.body.avatar,
      memberIds: req.body.members || [],
    });

    const io = req.app.get("io");

    conv.members.forEach((member) => {
      io.to(`user:${member.userId._id || member.userId}`).emit("conversation:update", {
        conversationId: conv._id,
        lastMessage: conv.lastAction,
        updatedAt: conv.updatedAt,
      });
    });

    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const addMembers = async (req, res, next) => {
  try {
    // req.body.newMemberIds là mảng ID
    const result = await convoService.addMembersToGroup({
      conversationId: req.params.id,
      actorId: req.user.id,
      newMemberIds: req.body.newMemberIds,
    });

    const io = req.app.get("io");
    // Notify update group
    io.to(`conv:${req.params.id}`).emit("group:update", {
      conversationId: req.params.id,
      message: result.message,
      members: result.conversation.members,
    });

    // Notify riêng cho những người mới được thêm (để họ thấy nhóm ngay)
    req.body.newMemberIds.forEach((uid) => {
      io.to(`user:${uid}`).emit("conversation:update", {
        conversationId: result.conversation._id,
        conversation: result.conversation,
        lastMessage: result.message,
        updatedAt: new Date(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const conv = await convoService.updateGroupInfo({
      conversationId: req.params.id,
      userId: req.user.id,
      title: req.body.title,
      avatar: req.body.avatar,
    });

    // Notify qua socket (Realtime cập nhật tên/ảnh nhóm cho mọi người)
    const io = req.app.get("io");
    conv.members.forEach((m) => {
      io.to(`user:${m.userId}`).emit("conversation:update", {
        conversationId: conv._id,
        conversation: conv, // Gửi full info mới để client update
      });
    });

    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const addMember = async (req, res, next) => {
  try {
    const conv = await convoService.addMember({
      conversationId: req.body.conversationId,
      actorId: req.user.id,
      newMemberId: req.body.userId,
    });
    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const conv = await convoService.removeMember({
      conversationId: req.body.conversationId,
      actorId: req.user.id,
      targetMemberId: req.body.userId,
    });
    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const convs = await convoService.getConversationsForUser(req.user.id);
    res.json({ success: true, conversations: convs });
  } catch (err) {
    next(err);
  }
};

export const detail = async (req, res, next) => {
  try {
    const conv = await convoService.getConversationById(req.params.id, req.user.id);
    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const joinByInvite = async (req, res, next) => {
  try {
    const result = await convoService.joinByInviteCode({
      inviteCode: req.body.inviteCode,
      userId: req.user.id,
    });

    // Nếu là thành viên MỚI -> Bắn socket
    if (result.isNew) {
      const io = req.app.get("io");

      // 1. Báo trong nhóm (hiện tin nhắn hệ thống)
      io.to(`conv:${result.conversation._id}`).emit("group:update", {
        conversationId: result.conversation._id,
        message: result.message,
        members: result.conversation.members,
      });

      // 2. Báo riêng cho người mới join (để update sidebar)
      io.to(`user:${req.user.id}`).emit("conversation:update", {
        conversationId: result.conversation._id,
        conversation: result.conversation,
        lastMessage: result.message,
        updatedAt: new Date(),
      });
    }

    res.json({ success: true, conversation: result.conversation });
  } catch (err) {
    next(err);
  }
};
export const deleteConversation = async (req, res, next) => {
  try {
    await convoService.deleteConversationForUser(req.params.id, req.user.id);
    res.json({ success: true, message: "Deleted conversation history" });
  } catch (err) {
    next(err);
  }
};

export const leaveGroup = async (req, res, next) => {
  try {
    const result = await convoService.leaveGroup({
      conversationId: req.params.id,
      userId: req.user.id,
    });

    if (result.disbanded) {
      const io = req.app.get("io");
      io.to(`conv:${req.params.id}`).emit("group:memberLeft", { conversationId: req.params.id, userId: req.user.id });
    } else {
      const io = req.app.get("io");
      io.to(`conv:${req.params.id}`).emit("group:update", {
        conversationId: req.params.id,
        message: result.message,
        members: result.conversation.members,
      });
    }
    const io = req.app.get("io");
    const socketIds = await redis.smembers(`user_sockets:${req.user.id}`);
    socketIds.forEach((socketId) => {
      io.in(socketId).socketsLeave(`conv:${req.params.id}`);
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const disbandGroup = async (req, res, next) => {
  try {
    const result = await convoService.disbandGroup({
      conversationId: req.params.id,
      userId: req.user.id,
    });

    const io = req.app.get("io");

    // Thay vì 'conversation:disbanded', ta dùng 'group:update' để cập nhật trạng thái
    // Frontend sẽ nhận được conv mới có isDisbanded = true
    io.to(`conv:${req.params.id}`).emit("group:update", {
      conversationId: req.params.id,
      message: result.message,
      conversation: result.conversation,
      members: result.conversation.members,
    });

    // Notify sidebar update cho tất cả member
    result.conversation.members.forEach((m) => {
      io.to(`user:${m.userId._id}`).emit("conversation:update", {
        conversationId: req.params.id,
        lastMessage: result.message,
        updatedAt: new Date(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const result = await convoService.updateMemberRole({
      conversationId: req.params.id,
      ownerId: req.user.id,
      memberId: req.body.memberId,
      role: req.body.role,
    });

    const io = req.app.get("io");
    io.to(`conv:${req.params.id}`).emit("group:update", {
      conversationId: req.params.id,
      message: result.message,
      members: result.conversation.members,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const kickMember = async (req, res, next) => {
  try {
    const result = await convoService.kickMember({
      conversationId: req.params.id,
      adminId: req.user.id,
      memberId: req.body.memberId,
    });

    const io = req.app.get("io");
    const conversationRoom = `conv:${req.params.id}`;
    const targetUserId = req.body.memberId;

    // 1. Báo cho CẢ NHÓM (update UI)
    io.to(conversationRoom).emit("group:update", {
      conversationId: req.params.id,
      message: result.message,
      members: result.conversation.members,
    });

    // 2. Báo riêng cho người bị kích (update UI)
    io.to(`user:${targetUserId}`).emit("group:update", {
      conversationId: req.params.id,
      message: result.message,
      members: result.conversation.members,
      // Cờ hiệu để frontend biết mình bị kick (option bổ sung)
      isKicked: true,
    });

    // --- 3. LOGIC MỚI: CƯỠNG CHẾ RỜI ROOM SOCKET ---
    // Lấy danh sách socketID của user bị kích từ Redis
    const socketIds = await redis.smembers(`user_sockets:${targetUserId}`);
    if (socketIds && socketIds.length > 0) {
      // Yêu cầu tất cả socket của user này rời khỏi room chat ngay lập tức
      // io.in(socketId).socketsLeave(room) hoạt động tốt với Socket.io v4
      socketIds.forEach((socketId) => {
        io.in(socketId).socketsLeave(conversationRoom);
      });
    }
    // ----------------------------------------------

    res.json({ success: true, conversation: result.conversation });
  } catch (err) {
    next(err);
  }
};
