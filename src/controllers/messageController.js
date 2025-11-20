import * as messageService from "../services/messageService.js";

export const send = async (req, res, next) => {
  try {
    const msg = await messageService.sendMessage({
      conversationId: req.body.conversationId,
      senderId: req.user.id,
      type: req.body.type,
      text: req.body.text,
      fileUrl: req.body.fileUrl,
      metadata: req.body.metadata,
    });
    res.json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const msgs = await messageService.getMessages({
      conversationId: req.params.conversationId,
      limit: Number(req.query.limit) || 20,
      cursor: req.query.cursor || null,
    });
    res.json({ success: true, messages: msgs });
  } catch (err) {
    next(err);
  }
};

export const edit = async (req, res, next) => {
  try {
    const msg = await messageService.editMessage({
      messageId: req.body.messageId,
      editorId: req.user.id,
      newText: req.body.text,
    });
    res.json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const msg = await messageService.deleteMessage({
      messageId: req.body.messageId,
      actorId: req.user.id,
    });
    res.json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

export const react = async (req, res, next) => {
  try {
    const msg = await messageService.reactToMessage({
      messageId: req.body.messageId,
      userId: req.user.id,
      emoji: req.body.emoji,
    });
    res.json({ success: true, reactions: msg.reactions });
  } catch (err) {
    next(err);
  }
};
