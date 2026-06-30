'use strict';

const authService = require('../services/authService');
const { sendSuccess } = require('../helpers/ApiResponse');
const { HTTP_STATUS, MESSAGES } = require('../constants');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  sendSuccess(res, MESSAGES.REGISTER_SUCCESS, result, HTTP_STATUS.CREATED);
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body, req);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(res, MESSAGES.LOGIN_SUCCESS, { accessToken, user });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  await authService.logout(req.user.id, refreshToken);
  res.clearCookie('refreshToken');
  sendSuccess(res, MESSAGES.LOGOUT_SUCCESS);
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Refresh token required.' });
  const result = await authService.refreshAccessToken(token);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(res, MESSAGES.TOKEN_REFRESHED, { accessToken: result.accessToken });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.query.token);
  sendSuccess(res, result.message);
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, MESSAGES.PASSWORD_RESET_EMAIL);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  res.clearCookie('refreshToken');
  sendSuccess(res, result.message);
});

const sendOTP = asyncHandler(async (req, res) => {
  const result = await authService.sendOTP(req.body.emailOrPhone);
  sendSuccess(res, result.message);
});

const verifyOTP = asyncHandler(async (req, res) => {
  const result = await authService.verifyOTP(req.body.emailOrPhone, req.body.otp);
  sendSuccess(res, result.message);
});

const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'idToken is required.' });

  const { accessToken, refreshToken, user, isNewUser } = await authService.googleAuth(idToken, req);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(
    res,
    isNewUser ? 'Account created via Google.' : 'Google login successful.',
    { accessToken, user, isNewUser },
    isNewUser ? HTTP_STATUS.CREATED : HTTP_STATUS.OK,
  );
});

module.exports = { register, login, logout, refreshToken, verifyEmail, forgotPassword, resetPassword, sendOTP, verifyOTP, googleAuth };
