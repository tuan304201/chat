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

export const addMembersToGroup = async ({ conversationId, actorId, newMemberIds }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Group not found");

  // Người mời phải đang ở trong nhóm (và chưa rời)
  const actor = conv.members.find((m) => m.userId.toString() === actorId.toString());
  if (!actor || actor.leftAt) throw new Error("Not authorized");

  for (const uid of newMemberIds) {
    const existingMember = conv.members.find((m) => m.userId.toString() === uid.toString());

    if (existingMember) {
      // CASE: User cũ quay lại -> Reset trạng thái
      existingMember.leftAt = null; // Quan trọng: Đánh dấu Active lại
      existingMember.role = "member"; // Reset quyền về member thường
      // existingMember.deletedAt = null; // (Tuỳ chọn) Nếu muốn hiện lại lịch sử chat cũ đã xóa
    } else {
      // CASE: User mới tinh
      conv.members.push({ userId: uid, role: "member" });
    }
  }

  // Tạo system message
  const actorUser = await mongoose.model("User").findById(actorId);
  const sysMsg = new Message({
    conversationId,
    sender: actorId,
    type: "system",
    text: `${actorUser.displayName} đã thêm thành viên mới vào nhóm.`,
  });
  await sysMsg.save();

  conv.lastMessage = sysMsg._id;
  conv.lastAction = { type: "system", text: sysMsg.text, sender: actorId, createdAt: new Date() };
  conv.updatedAt = new Date();

  await conv.save();
  await conv.populate("members.userId", "_id username displayName avatarUrl");

  return { conversation: conv, message: sysMsg };
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

  // 1. Query tất cả hội thoại (Bỏ skip/limit ở đây để lọc thủ công bên dưới)
  const convs = await Conversation.find({
    "members.userId": userId,
    $or: [{ type: "group" }, { lastMessage: { $ne: null } }],
  })
    .sort({ updatedAt: -1 }) // Lấy mới nhất trước
    .populate({
      path: "lastMessage",
      select: "text fileUrl type createdAt sender isRecalled seenBy",
    })
    .populate("members.userId", "_id username displayName avatarUrl")
    .populate("lastAction.sender", "_id username displayName");

  const results = [];

  // 2. Duyệt qua từng hội thoại để xử lý logic
  for (const conv of convs) {
    const convObj = conv.toObject();

    // Lấy thông tin của chính mình trong hội thoại (để check deletedAt, lastViewedAt...)
    const currentMember = convObj.members.find((m) => m.userId._id.toString() === userId.toString());

    // --- LOGIC LỌC HỘI THOẠI ĐÃ XÓA ---
    const deletedAt = currentMember?.deletedAt ? new Date(currentMember.deletedAt) : null;

    const lastMsgDate = convObj.lastMessage ? new Date(convObj.lastMessage.createdAt) : new Date(0);

    // Nếu User đã xóa lịch sử VÀ tin nhắn cuối cùng cũ hơn thời điểm xóa
    // -> Thì ẩn hội thoại này đi (không push vào results)
    if (deletedAt && lastMsgDate <= deletedAt) {
      continue;
    }
    // ----------------------------------

    const lastViewedAt = currentMember?.lastViewedAt || new Date(0);
    const hasUnseenReaction = currentMember?.hasUnseenReaction || false;

    convObj.isPinned = currentMember.isPinned || false;
    convObj.muteUntil = currentMember.muteUntil || null;

    convObj.isMuted = convObj.muteUntil && new Date(convObj.muteUntil) > new Date();

    // 3. Logic hiển thị Preview (Ưu tiên lastAction nếu nó mới hơn tin nhắn)
    let previewDisplay = convObj.lastMessage;

    if (convObj.lastAction && new Date(convObj.lastAction.createdAt) > new Date(convObj.lastMessage?.createdAt || 0)) {
      // Chỉ hiển thị action (vd: "Đã thả tim") nếu người thực hiện KHÔNG phải là mình
      if (convObj.lastAction.sender?._id.toString() !== userId.toString()) {
        previewDisplay = {
          ...convObj.lastMessage, // Giữ lại các trường cơ bản để tránh lỗi
          text: convObj.lastAction.text,
          sender: convObj.lastAction.sender,
          createdAt: convObj.lastAction.createdAt,
          type: "action", // Đánh dấu để Frontend biết đây là action notification
        };
      }
    }
    convObj.lastMessage = previewDisplay;

    // 4. Logic tính Badge (Số tin chưa đọc)
    const unreadMsgCount = await Message.countDocuments({
      conversationId: conv._id,
      createdAt: { $gt: lastViewedAt }, // Tin nhắn mới hơn thời điểm xem cuối
      sender: { $ne: userObjectId }, // Và không phải do mình gửi
    });

    // Tổng unread = Tin nhắn mới + 1 (nếu có reaction mới chưa xem)
    convObj.unreadCount = unreadMsgCount + (hasUnseenReaction ? 1 : 0);

    results.push(convObj);
  }

  results.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // Nếu cùng trạng thái pin thì giữ nguyên thứ tự (do DB đã sort time)
    return 0;
  });
  // 5. Cắt trang thủ công (Pagination)
  // Vì ta đã lọc bớt hội thoại đã xóa, nên phải slice ở bước
  return results.slice(skip, skip + limit);
};

export const togglePin = async ({ conversationId, userId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Not found");

  const member = conv.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) throw new Error("Not authorized");

  member.isPinned = !member.isPinned;
  await conv.save();

  return { conversationId, isPinned: member.isPinned };
};

export const muteConversation = async ({ conversationId, userId, duration }) => {
  // duration: số phút (number). Ví dụ: 15, 60, 480.
  // Nếu -1 là "Đến khi tôi mở lại" (Set năm 2099)
  // Nếu 0 là "Bật lại thông báo"

  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Not found");

  const member = conv.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) throw new Error("Not authorized");

  let muteDate = null;
  if (duration === 0) {
    muteDate = null; // Unmute
  } else if (duration === -1) {
    muteDate = new Date("2099-12-31"); // Forever until toggle
  } else {
    muteDate = new Date(Date.now() + duration * 60000); // Current + minutes
  }

  member.muteUntil = muteDate;
  await conv.save();

  return { conversationId, muteUntil: member.muteUntil, isMuted: !!muteDate };
};

export const deleteConversationForUser = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Conversation not found");

  const member = conv.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) throw new Error("Not a member of this conversation");

  // Cập nhật thời điểm xóa là hiện tại
  member.deletedAt = new Date();

  // Reset luôn các trạng thái unread/reaction cũ nếu muốn sạch sẽ
  member.hasUnseenReaction = false;
  // member.lastViewedAt = new Date(); // (Tuỳ chọn)

  await conv.save();
  return true;
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

  if (member.leftAt) {
    const restrictedConv = conv.toObject();
    restrictedConv.members = [];
    restrictedConv.inviteCode = null;
    restrictedConv.isKicked = true;
    return restrictedConv;
  }

  return conv;
};

export const joinByInviteCode = async ({ inviteCode, userId }) => {
  const conv = await Conversation.findOne({ inviteCode });
  if (!conv) throw new Error("Liên kết tham gia không hợp lệ");
  if (conv.type !== "group") throw new Error("Liên kết không hợp lệ");
  if (conv.isDisbanded) throw new Error("Nhóm này đã bị giải tán");

  const member = conv.members.find((m) => m.userId.toString() === userId.toString());

  // CASE 1: Đang là thành viên active -> Return luôn
  if (member && !member.leftAt) {
    await conv.populate("members.userId", "_id username displayName avatarUrl");
    return { conversation: conv, isNew: false };
  }

  // CASE 2: Rejoin hoặc Join mới
  if (member) {
    // Đã từng join và đã rời -> Reset
    member.leftAt = null;
    member.role = "member";
  } else {
    // Chưa từng join
    conv.members.push({ userId, role: "member" });
  }

  // Tạo system message
  const user = await mongoose.model("User").findById(userId);
  const sysMsg = new Message({
    conversationId: conv._id,
    sender: userId,
    type: "system",
    text: `${user.displayName} đã tham gia nhóm qua liên kết mời.`,
  });
  await sysMsg.save();

  conv.lastMessage = sysMsg._id;
  conv.lastAction = { type: "system", text: sysMsg.text, createdAt: new Date() };
  conv.updatedAt = new Date();

  await conv.save();
  await conv.populate("members.userId", "_id username displayName avatarUrl");

  return { conversation: conv, message: sysMsg, isNew: true };
};

export const createGroup = async ({ ownerId, title, memberIds = [], avatar }) => {
  if (!ownerId) throw new Error("Missing owner id");
  const owner = await mongoose.model("User").findById(ownerId);

  // Owner là admin
  const members = [
    { userId: ownerId, role: "admin" },
    ...memberIds.filter((id) => id.toString() !== ownerId.toString()).map((id) => ({ userId: id })),
  ];

  const conv = new Conversation({
    type: "group",
    title: title || "Nhóm mới",
    avatar: avatar || null,
    members,
    ownerId: ownerId,
    inviteCode: uuidv4(),
  });

  // Tạo tin nhắn hệ thống thông báo
  const systemMsg = new Message({
    conversationId: conv._id,
    sender: ownerId,
    type: "system",
    text: `${owner.displayName} đã tạo nhóm và thêm bạn vào nhóm.`,
  });
  await systemMsg.save();

  conv.lastMessage = systemMsg._id;
  conv.lastAction = {
    type: "system",
    text: systemMsg.text,
    sender: ownerId,
    createdAt: new Date(),
  };

  await conv.save();
  await conv.populate("members.userId", "_id username displayName avatarUrl");
  return conv;
};

export const leaveGroup = async ({ conversationId, userId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv || conv.type !== "group") throw new Error("Group not found");

  const member = conv.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) throw new Error("You are not in this group");
  if (member.leftAt) throw new Error("You have already left this group");

  // Đánh dấu thời điểm rời
  member.leftAt = new Date();

  // Nếu không còn ai active (tất cả đều leftAt) -> Giải tán
  const activeMembers = conv.members.filter((m) => !m.leftAt);
  if (activeMembers.length === 0) {
    // Logic cũ: xóa luôn. Logic mới: Đánh dấu giải tán (để lưu lịch sử cho mọi người)
    conv.isDisbanded = true;
  }

  // Tạo tin nhắn hệ thống
  const user = await mongoose.model("User").findById(userId);
  const sysMsg = await createSystemMessage(conv, `${user.displayName} đã rời nhóm.`);

  await conv.save();

  // Populate để trả về list member (cho frontend lọc hiển thị)
  await conv.populate("members.userId", "_id username displayName avatarUrl");

  return { conversation: conv, message: sysMsg, disbanded: conv.isDisbanded };
};

export const disbandGroup = async ({ conversationId, userId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Group not found");

  // Check quyền Owner
  const isOwner = conv.ownerId
    ? conv.ownerId.toString() === userId.toString()
    : conv.members[0].userId.toString() === userId.toString();

  if (!isOwner) throw new Error("Chỉ trưởng nhóm mới có quyền giải tán nhóm");

  // --- THAY ĐỔI: set isDisbanded = true ---
  conv.isDisbanded = true;

  // Tạo tin nhắn hệ thống
  const owner = await mongoose.model("User").findById(userId);
  const sysMsg = new Message({
    conversationId: conv._id,
    sender: userId,
    type: "system",
    text: `Nhóm đã bị giải tán bởi trưởng nhóm ${owner.displayName}.`,
  });
  await sysMsg.save();

  conv.lastMessage = sysMsg._id;
  conv.lastAction = { type: "system", text: sysMsg.text, createdAt: new Date() };
  conv.updatedAt = new Date();

  await conv.save();

  // Populate để trả về frontend update UI
  await conv.populate("members.userId", "_id username displayName avatarUrl");

  return { conversation: conv, message: sysMsg };
};

export const kickMember = async ({ conversationId, adminId, memberId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Group not found");

  // 1. Check quyền Admin (người thực hiện)
  const admin = conv.members.find((m) => m.userId.toString() === adminId.toString() && !m.leftAt);
  if (!admin || admin.role !== "admin") throw new Error("Not authorized");

  // 2. Tìm người bị kích
  const target = conv.members.find((m) => m.userId.toString() === memberId.toString());
  if (!target) throw new Error("Member not found");

  // Check nếu người bị kích đã rời nhóm rồi
  if (target.leftAt) throw new Error("Member already left");

  // Check không cho kích Admin khác (trừ khi là Owner - logic nâng cao, ở đây giữ đơn giản)
  const isTargetOwner = conv.ownerId?.toString() === memberId.toString();
  if (isTargetOwner) throw new Error("Cannot kick the Owner");

  if (target.role === "admin" && conv.ownerId?.toString() !== adminId.toString()) {
    throw new Error("Phó nhóm không thể mời Phó nhóm khác ra khỏi nhóm");
  }

  // --- THAY ĐỔI QUAN TRỌNG: SOFT KICK ---
  // Thay vì: conv.members = conv.members.filter(...) -> Xóa vĩnh viễn
  // Ta dùng: target.leftAt = new Date() -> Đánh dấu đã rời
  target.leftAt = new Date();
  // --------------------------------------

  // 3. Tạo thông báo hệ thống
  const targetUser = await mongoose.model("User").findById(memberId);
  const sysMsg = await createSystemMessage(conversationId, `${targetUser.displayName} đã bị mời ra khỏi nhóm.`);

  await conv.save();

  // Populate để trả về dữ liệu hiển thị đầy đủ
  await conv.populate("members.userId", "_id username displayName avatarUrl");

  return { conversation: conv, message: sysMsg };
};

export const updateMemberRole = async ({ conversationId, ownerId, memberId, role }) => {
  const conv = await Conversation.findById(conversationId);
  // Chỉ người tạo nhóm (Admin gốc) mới có quyền set admin khác
  // Ở đây giả sử người tạo nhóm nằm đầu mảng members hoặc check logic khác.
  // Logic đơn giản: Người thực hiện phải là admin.
  const owner = conv.members.find((m) => m.userId.toString() === ownerId.toString());
  if (!owner || owner.role !== "admin") throw new Error("Not authorized");

  const targetMember = conv.members.find((m) => m.userId.toString() === memberId.toString());
  if (targetMember) targetMember.role = role;

  const targetUser = await mongoose.model("User").findById(memberId);
  const actionText = role === "admin" ? "được bổ nhiệm làm quản trị viên" : "bị hủy quyền quản trị viên";

  const sysMsg = await createSystemMessage(conversationId, `${targetUser.displayName} ${actionText}.`);

  await conv.save();
  await conv.populate("members.userId", "_id username displayName avatarUrl");
  return { conversation: conv, message: sysMsg };
};

export const updateGroupInfo = async ({ conversationId, userId, title, avatar }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new Error("Conversation not found");
  if (conv.type !== "group") throw new Error("Not a group");

  const isOwner = conv.ownerId
    ? conv.ownerId.toString() === userId.toString()
    : conv.members[0].userId.toString() === userId.toString();

  if (!isOwner) throw new Error("Chỉ trưởng nhóm mới được thay đổi thông tin nhóm");

  if (title) conv.title = title;
  if (avatar) conv.avatar = avatar;

  // Lưu log action
  conv.lastAction = {
    type: "system", // hoặc message
    text: `${member.userId.displayName || "Ai đó"} đã cập nhật thông tin nhóm`,
    sender: userId,
    createdAt: new Date(),
  };
  conv.updatedAt = new Date();

  await conv.save();
  return conv;
};

async function createSystemMessage(conversationId, text) {
  const msg = new Message({
    conversationId,
    sender: null,
    type: "system",
    text,
  });

  const conv = await Conversation.findById(conversationId);
  if (!msg.sender) msg.sender = conv.members[0].userId;

  await msg.save();

  conv.lastMessage = msg._id;
  conv.lastAction = { type: "system", text, createdAt: new Date() };
  conv.updatedAt = new Date();
  await conv.save();

  return msg;
}
