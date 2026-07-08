'use strict';

const authService = require('../services/authService');
const { sendSuccess } = require('../helpers/ApiResponse');
const { HTTP_STATUS, MESSAGES } = require('../constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../helpers/ApiError');

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.COOKIE_SAME_SITE || 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body, req);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
  sendSuccess(res, MESSAGES.LOGIN_SUCCESS, { accessToken, user });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  await authService.logout(req.user.id, refreshToken);
  res.clearCookie('refreshToken', { path: '/api/auth' });
  sendSuccess(res, MESSAGES.LOGOUT_SUCCESS);
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('Refresh token required.');
  const result = await authService.refreshAccessToken(token);
  res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());
  sendSuccess(res, MESSAGES.TOKEN_REFRESHED, { accessToken: result.accessToken });
});

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  sendSuccess(res, MESSAGES.REGISTER_SUCCESS, result, HTTP_STATUS.CREATED);
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
  res.clearCookie('refreshToken', { path: '/api/auth' });
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
  if (!idToken) throw ApiError.badRequest('idToken is required.');
  const { accessToken, refreshToken, user, isNewUser } = await authService.googleAuth(idToken, req);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
  sendSuccess(
    res,
    isNewUser ? MESSAGES.GOOGLE_ACCOUNT_CREATED : MESSAGES.GOOGLE_AUTH_SUCCESS,
    { accessToken, user, isNewUser },
    isNewUser ? HTTP_STATUS.CREATED : HTTP_STATUS.OK,
  );
});

module.exports = { register, login, logout, refreshToken, verifyEmail, forgotPassword, resetPassword, sendOTP, verifyOTP, googleAuth };
