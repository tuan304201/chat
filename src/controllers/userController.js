import * as userService from "../services/userService.js";

export const getProfile = async (req, res, next) => {
  try {
    const result = await userService.getById(req.user.id);
    res.json({ success: true, user: result });
  } catch (err) {
    next(err);
  }
};

export const search = async (req, res, next) => {
  try {
    const q = req.query.q || "";
    const users = await userService.searchByUsername(q, req.user.id);
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
};

export const friends = async (req, res, next) => {
  try {
    const friends = await userService.getFriends(req.user.id);
    res.json({ success: true, friends });
  } catch (err) {
    next(err);
  }
};
