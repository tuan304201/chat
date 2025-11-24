import * as friendService from "../services/friendService.js";

export const sendRequest = async (req, res, next) => {
  try {
    const result = await friendService.sendRequest({
      fromId: req.user.id,
      toId: req.body.toId,
    });

    await result.populate("from", "_id username displayName avatarUrl");

    const io = req.app.get("io");

    // Notify người nhận
    io.to(`user:${req.body.toId}`).emit("friend:new_request", result);

    // Notify người gửi (để update UI trạng thái "đã gửi")
    io.to(`user:${req.user.id}`).emit("friend:request_sent", result);

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

    const io = req.app.get("io");

    // Notify người gửi request
    io.to(`user:${result.from}`).emit("friend:request_accepted", {
      friendId: req.user.id,
      friend: req.user,
    });

    // Notify người chấp nhận
    io.to(`user:${req.user.id}`).emit("friend:you_accepted", {
      friendId: result.from,
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

    const io = req.app.get("io");

    // Notify người gửi yêu cầu: bị từ chối
    io.to(`user:${result.from}`).emit("friend:request_declined", {
      requestId: result._id,
      by: req.user.id,
    });

    // Notify người từ chối (để update UI)
    io.to(`user:${req.user.id}`).emit("friend:you_declined", {
      requestId: result._id,
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

    const io = req.app.get("io");

    // Notify người nhận: yêu cầu đã bị hủy
    io.to(`user:${result.to}`).emit("friend:request_canceled", {
      requestId: result._id,
      by: req.user.id,
    });

    // Notify người gửi
    io.to(`user:${req.user.id}`).emit("friend:you_canceled", {
      requestId: result._id,
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

    const io = req.app.get("io");

    // Notify cả 2 bên
    io.to(`user:${req.user.id}`).emit("friend:unfriended", {
      friendId: req.body.friendId,
    });

    io.to(`user:${req.body.friendId}`).emit("friend:unfriended", {
      friendId: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
