'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../repositories/prismaClient');
const userRepo = require('../repositories/userRepo');
const { generateAuthTokens, generateToken, verifyToken } = require('../helpers/tokenHelper');
const { generateOTP, hashOTP, compareOTP } = require('../utils/otpUtils');
const { sendEmail } = require('../utils/mailer');
const ApiError = require('../helpers/ApiError');
const { MESSAGES, TOKEN_TYPE, ROLES } = require('../constants');
const analytics = require('./analyticsService');

// Lazily resolved so the client always picks up the env var at call-time
function getGoogleClient() {
  if (!process.env.GOOGLE_CLIENT_ID) throw ApiError.internal('Google OAuth is not configured.');
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

class AuthService {
  async register({ firstName, lastName, email, phone, password, address, pincode, landmark, city, state }, req) {
    const exists = await userRepo.findByEmail(email);
    if (exists) throw ApiError.conflict(MESSAGES.EMAIL_ALREADY_EXISTS);

    const userData = { firstName, lastName, email, phone, password, role: ROLES.USER };
    
    // Add address if provided
    if (address || pincode || city || state) {
      userData.addresses = [{
        fullName: `${firstName} ${lastName}`,
        phone: phone || '',
        addressLine1: address || '',
        addressLine2: landmark || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        isDefault: true
      }];
    }

    // userData.isEmailVerified bypassed for local dev — remove this line for production
    // userData.isEmailVerified = true;

    const user = await userRepo.create(userData);

    // Track registration (fire-and-forget)
    if (req) analytics.track(() => analytics.trackRegistration(req, user.id, email));

    // Send verification email
    const verifyToken_ = generateToken({ userId: user.id }, TOKEN_TYPE.EMAIL_VERIFY);
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken_}`;
    await sendEmail({
      to: email,
      subject: 'Verify Your Email — Medical E-Commerce',
      template: 'emailVerification',
      data: { name: firstName, verifyUrl },
    });

    return { user: user.toPublicJSON() };
  }

  async login({ email, password }, req) {
    const user = await userRepo.findByEmail(email);
    if (!user) throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
    if (!user.isActive) throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);
    if (user.lockUntil && user.lockUntil > new Date()) throw ApiError.forbidden('Account temporarily locked. Try again later.');

    // Google-only accounts have no password set
    if (!user.password) throw ApiError.badRequest('This account uses Google sign-in. Please login with Google.');

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      await this._handleFailedLogin(user, email, req);
      throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
    }

    // Restore email verification check for production
    if (!user.isEmailVerified) throw ApiError.forbidden(MESSAGES.ACCOUNT_NOT_VERIFIED);

    const { accessToken, refreshToken } = generateAuthTokens(user.id, user.role);
    await userRepo.addRefreshToken(user.id, refreshToken);
    await userRepo.updateLastLogin(user.id);

    // Reset login attempts on success
    if (user.loginAttempts > 0) {
      await userRepo.updateById(user.id, { loginAttempts: 0, lockUntil: null });
    }

    // Track successful login — trackLogin is awaited so sessionId is available
    // before res.finish fires in analyticsMiddleware
    if (req) {
      req.analyticsUserId = user.id;
      const sessionId = await analytics.trackLogin(req, {
        userId: user.id, email, success: true, sessionToken: refreshToken,
      });
      req.analyticsSessionId = sessionId;
    }

    return { accessToken, refreshToken, user: user.toPublicJSON() };
  }

  async _handleFailedLogin(user, email, req) {
    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 min
    const attempts = (user.loginAttempts || 0) + 1;
    const update = { loginAttempts: attempts };
    if (attempts >= MAX_ATTEMPTS) update.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    await userRepo.updateById(user.id, update);

    if (req) {
      const reason = attempts >= MAX_ATTEMPTS ? 'account_locked' : 'invalid_password';
      analytics.track(() => analytics.trackLogin(req, {
        userId: user.id, email: email || user.email, success: false, failReason: reason,
      }));
    }
  }

  async logout(userId, refreshToken) {
    // Find the exact session tied to this refreshToken before removing it
    const session = await prisma.userSession.findFirst({
      where: { userId, sessionToken: refreshToken, isActive: true },
      select: { id: true },
    });
    await userRepo.removeRefreshToken(userId, refreshToken);
    analytics.track(() => analytics.trackLogout(userId, session?.id || null));
  }

  async refreshAccessToken(refreshToken) {
    const payload = verifyToken(refreshToken, TOKEN_TYPE.REFRESH);
    const user = await userRepo.findById(payload.userId);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw ApiError.unauthorized('Invalid refresh token.');
    }

    const { accessToken, refreshToken: newRefreshToken } = generateAuthTokens(user.id, user.role);
    await userRepo.removeRefreshToken(user.id, refreshToken);
    await userRepo.addRefreshToken(user.id, newRefreshToken);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async verifyEmail(token) {
    const payload = verifyToken(token, TOKEN_TYPE.EMAIL_VERIFY);
    const user = await userRepo.findById(payload.userId);
    if (!user) throw ApiError.notFound('User not found.');
    if (user.isEmailVerified) return { message: 'Email already verified.' };
    await userRepo.updateById(payload.userId, { isEmailVerified: true });
    return { message: MESSAGES.EMAIL_VERIFIED };
  }

  async forgotPassword(email) {
    const user = await userRepo.findByEmail(email);
    if (!user) return; // Silently succeed — don't reveal email existence
    const token = generateToken({ userId: user.id }, TOKEN_TYPE.RESET_PASSWORD);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Reset Your Password — Medical E-Commerce',
      template: 'forgotPassword',
      data: { name: user.firstName, resetUrl },
    });
  }

  async resetPassword(token, newPassword) {
    const payload = verifyToken(token, TOKEN_TYPE.RESET_PASSWORD);
    const hashed = await bcrypt.hash(newPassword, 12);
    await userRepo.updateById(payload.userId, { password: hashed });
    // Clear all refresh tokens AND close all active sessions
    await Promise.all([
      userRepo.clearAllRefreshTokens(payload.userId),
      prisma.userSession.updateMany({
        where: { userId: payload.userId, isActive: true },
        data: { isActive: false, logoutAt: new Date() },
      }),
    ]);
    return { message: MESSAGES.PASSWORD_RESET_SUCCESS };
  }

  async sendOTP(phoneOrEmail) {
    const otp = generateOTP(parseInt(process.env.OTP_LENGTH, 10) || 6);
    const hashed = await hashOTP(otp);
    const expiry = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10) * 60 * 1000);

    const user = await userRepo.findByEmail(phoneOrEmail)
      || await userRepo.findByPhone(phoneOrEmail);
    if (!user) throw ApiError.notFound('Account not found.');

    await userRepo.updateById(user.id, { otp: hashed, otpExpiry: expiry, otpAttempts: 0 });

    await sendEmail({ to: user.email, subject: 'Your OTP — Medical E-Commerce', template: 'otp', data: { otp, name: user.firstName } });
    return { message: MESSAGES.OTP_SENT };
  }

  async verifyOTP(phoneOrEmail, otp) {
    const user = await userRepo.findByEmail(phoneOrEmail)
      || await userRepo.findByPhone(phoneOrEmail);
    if (!user) throw ApiError.notFound('Account not found.');

    if (!user.otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      throw ApiError.badRequest(MESSAGES.OTP_INVALID);
    }

    const isMatch = await compareOTP(otp, user.otp);
    if (!isMatch) {
      await userRepo.incrementOtpAttempts(user.id);
      throw ApiError.badRequest(MESSAGES.OTP_INVALID);
    }

    await userRepo.updateById(user.id, { otp: null, otpExpiry: null, isPhoneVerified: true });
    return { message: MESSAGES.OTP_VERIFIED };
  }

  /**
   * Google OAuth — verify Google id_token, find-or-create user, return JWT pair.
   * Frontend sends the id_token obtained from Google Sign-In SDK.
   */
  async googleAuth(idToken, req) {
    const googleClient = getGoogleClient();

    // Verify the token with Google
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw ApiError.badRequest('Invalid Google token.');
    }

    const { sub: googleId, email, given_name: firstName, family_name: lastName, picture } = payload;

    if (!email) throw ApiError.badRequest('Google account has no email associated.');

    // Find existing user by googleId first, then fall back to email
    let user = await userRepo.findOne({ googleId }) || await userRepo.findByEmail(email);

    const isNewUser = !user;

    if (isNewUser) {
      // New user — create with avatar object so toPrismaData maps it correctly
      user = await userRepo.create({
        firstName: firstName || 'User',
        lastName: lastName || '',
        email,
        googleId,
        avatar: picture ? { url: picture } : null,
        isEmailVerified: true,
        role: ROLES.USER,
      });
    } else {
      // isActive check BEFORE doing any writes
      if (!user.isActive) throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);

      // Link googleId / avatar if missing
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar && picture) updates.avatar = { url: picture };
      if (!user.isEmailVerified) updates.isEmailVerified = true;
      if (Object.keys(updates).length) {
        const updated = await userRepo.updateById(user.id, updates);
        if (updated) user = updated;
      }
    }

    const { accessToken, refreshToken } = generateAuthTokens(user.id, user.role);
    await userRepo.addRefreshToken(user.id, refreshToken);
    await userRepo.updateLastLogin(user.id);

    if (req) {
      req.analyticsUserId = user.id;
      // trackRegistration fire-and-forget (non-critical), trackLogin awaited for sessionId
      if (isNewUser) analytics.track(() => analytics.trackRegistration(req, user.id, email));
      const sessionId = await analytics.trackLogin(req, {
        userId: user.id, email, success: true, sessionToken: refreshToken,
      });
      req.analyticsSessionId = sessionId;
    }

    return { accessToken, refreshToken, user: user.toPublicJSON(), isNewUser };
  }
}

module.exports = new AuthService();
