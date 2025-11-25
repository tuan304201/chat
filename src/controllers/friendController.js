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

    // Notify người gửi request (Fix: ép kiểu toString để room chính xác)
    io.to(`user:${result.from.toString()}`).emit("friend:request_accepted", {
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
    // FIX: Thêm .toString()
    io.to(`user:${result.from.toString()}`).emit("friend:request_declined", {
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
    // result bây giờ là object request đã xóa (nhờ bước 1)
    const result = await friendService.cancelRequest({
      requestId: req.body.requestId,
      senderId: req.user.id,
    });

    const io = req.app.get("io");

    // Notify người nhận: yêu cầu đã bị hủy
    // FIX: Thêm .toString() và đảm bảo result.to tồn tại
    if (result.to) {
      io.to(`user:${result.to.toString()}`).emit("friend:request_canceled", {
        requestId: result._id,
        by: req.user.id,
      });
    }

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

    // Fix: ép kiểu toString
    io.to(`user:${req.body.friendId.toString()}`).emit("friend:unfriended", {
      friendId: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
