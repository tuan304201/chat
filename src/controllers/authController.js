import * as authService from "../services/authService.js";

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.json({ success: true, user: result });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshTokens({
      refreshToken: req.body.refreshToken,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    await authService.revokeRefreshToken({ refreshToken: req.body.refreshToken });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
