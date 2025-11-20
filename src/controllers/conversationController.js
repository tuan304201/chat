import * as convoService from "../services/conversationService.js";

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
      memberIds: req.body.members || [],
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
    const conv = await convoService.joinByInviteCode({
      inviteCode: req.body.inviteCode,
      userId: req.user.id,
    });
    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};
