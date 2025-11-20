import * as friendService from "../services/friendService.js";

export const sendRequest = async (req, res, next) => {
  try {
    const result = await friendService.sendRequest({
      fromId: req.user.id,
      toId: req.body.toId,
    });
    res.json({ success: true, request: result });
  } catch (err) {
    next(err);
  }
};

export const accept = async (req, res, next) => {
  try {
    const result = await friendService.acceptRequest({
      requestId: req.body.requestId,
      acceptorId: req.user.id,
    });
    res.json({ success: true, request: result });
  } catch (err) {
    next(err);
  }
};

export const decline = async (req, res, next) => {
  try {
    const result = await friendService.declineRequest({
      requestId: req.body.requestId,
      declinerId: req.user.id,
    });
    res.json({ success: true, request: result });
  } catch (err) {
    next(err);
  }
};

export const cancel = async (req, res, next) => {
  try {
    const result = await friendService.cancelRequest({
      requestId: req.body.requestId,
      senderId: req.user.id,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const result = await friendService.listRequests(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const unfriend = async (req, res, next) => {
  try {
    await friendService.removeFriend({
      userId: req.user.id,
      friendId: req.body.friendId,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
