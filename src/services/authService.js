'use strict';

const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../repositories/prismaClient');
const userRepo = require('../repositories/userRepo');
const { generateAuthTokens, generateToken, verifyToken } = require('../helpers/tokenHelper');
const { generateOTP, hashOTP, compareOTP } = require('../utils/otpUtils');
const { sendEmail } = require('../utils/mailer');
const ApiError = require('../helpers/ApiError');
const { MESSAGES, TOKEN_TYPE, ROLES } = require('../constants');
const analytics = require('./analyticsService');
const { addWhatsAppJob } = require('../jobs');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId.includes('your_')) throw ApiError.badRequest('Google OAuth is not configured.');
  return new OAuth2Client(clientId);
}

/** Resolve a phone-or-email string to a user with a single targeted query. */
async function findUserByPhoneOrEmail(phoneOrEmail) {
  const isEmail = phoneOrEmail.includes('@');
  return isEmail
    ? userRepo.findByEmail(phoneOrEmail.toLowerCase())
    : userRepo.findByPhone(phoneOrEmail);
}

class AuthService {
  async register({ firstName, lastName, email, phone, password, address, pincode, landmark, city, state }, req) {
    const normalizedEmail = email.toLowerCase();
    const exists = await userRepo.findByEmail(normalizedEmail);
    if (exists) throw ApiError.conflict(MESSAGES.EMAIL_ALREADY_EXISTS);

    const userData = { firstName, lastName, email: normalizedEmail, phone, password, role: ROLES.USER };

    if (address || pincode || city || state) {
      userData.addresses = [{
        fullName: `${firstName} ${lastName}`,
        phone: phone || '',
        addressLine1: address || '',
        addressLine2: landmark || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        isDefault: true,
      }];
    }

    const user = await userRepo.create(userData);

    if (req) analytics.track(() => analytics.trackRegistration(req, user.id, email));

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
    const user = await userRepo.findByEmail(email.toLowerCase());
    if (!user) throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
    if (!user.isActive) throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);
    if (user.lockUntil && user.lockUntil > new Date()) throw ApiError.forbidden('Account temporarily locked. Try again later.');
    if (!user.password) throw ApiError.badRequest('This account uses Google sign-in. Please login with Google.');

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await this._handleFailedLogin(user, email, req);
      throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isEmailVerified) throw ApiError.forbidden(MESSAGES.ACCOUNT_NOT_VERIFIED);

    const { accessToken, refreshToken } = generateAuthTokens(user.id, user.role);
    await Promise.all([
      userRepo.addRefreshToken(user.id, refreshToken),
      userRepo.updateById(user.id, {
        lastLogin: new Date(),
        ...(user.loginAttempts > 0 && { loginAttempts: 0, lockUntil: null }),
      }),
    ]);

    if (req) {
      req.analyticsUserId = user.id;
      const sessionId = await analytics.trackLogin(req, {
        userId: user.id, email, success: true, sessionToken: refreshToken,
      });
      req.analyticsSessionId = sessionId;
      if (sessionId && req.res) req.res.locals.analyticsSessionId = sessionId;
    }

    return { accessToken, refreshToken, user: user.toPublicJSON() };
  }

  async _handleFailedLogin(user, email, req) {
    const attempts = (user.loginAttempts || 0) + 1;
    const update = { loginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) update.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    await userRepo.updateById(user.id, update);

    if (req) {
      const reason = attempts >= MAX_LOGIN_ATTEMPTS ? 'account_locked' : 'invalid_password';
      analytics.track(() => analytics.trackLogin(req, {
        userId: user.id, email: email || user.email, success: false, failReason: reason,
      }));
    }
  }

  async logout(userId, refreshToken) {
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
      if (user) await userRepo.clearAllRefreshTokens(user.id);
      throw ApiError.unauthorized('Invalid refresh token.');
    }
    if (!user.isActive) throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);

    const { accessToken, refreshToken: newRefreshToken } = generateAuthTokens(user.id, user.role);

    // Atomic token rotation: filter old, push new in a single update
    const updatedTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    updatedTokens.push(newRefreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokens: { set: updatedTokens } },
    });

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
    const user = await userRepo.findByEmail(email.toLowerCase());
    if (!user) return; // Silent — don't reveal whether email exists
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
    await userRepo.updateById(payload.userId, { password: newPassword });
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
    const otpLength = parseInt(process.env.OTP_LENGTH, 10) || 6;
    const otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;

    const user = await findUserByPhoneOrEmail(phoneOrEmail);
    if (!user) throw ApiError.notFound('Account not found.');

    const otp = generateOTP(otpLength);
    const hashed = await hashOTP(otp);
    const expiry = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

    await userRepo.updateById(user.id, { otp: hashed, otpExpiry: expiry, otpAttempts: 0 });

    await sendEmail({
      to: user.email,
      subject: 'Your OTP — Medical E-Commerce',
      template: 'otp',
      data: { otp, name: user.firstName },
    });

    if (user.phone) {
      addWhatsAppJob('sendOtpWhatsApp', user.phone, [otp, otpExpiryMinutes]).catch(() => {});
    }

    return { message: MESSAGES.OTP_SENT };
  }

  async verifyOTP(phoneOrEmail, otp) {
    const user = await findUserByPhoneOrEmail(phoneOrEmail);
    if (!user) throw ApiError.notFound('Account not found.');

    if (!user.otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      throw ApiError.badRequest(MESSAGES.OTP_INVALID);
    }

    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      await userRepo.updateById(user.id, { otp: null, otpExpiry: null, otpAttempts: 0 });
      throw ApiError.badRequest('Too many incorrect OTP attempts. Please request a new OTP.');
    }

    const isMatch = await compareOTP(otp, user.otp);
    if (!isMatch) {
      await userRepo.incrementOtpAttempts(user.id);
      throw ApiError.badRequest(MESSAGES.OTP_INVALID);
    }

    await userRepo.updateById(user.id, { otp: null, otpExpiry: null, isPhoneVerified: true });
    return { message: MESSAGES.OTP_VERIFIED };
  }

  async googleAuth(idToken, req) {
    const googleClient = getGoogleClient();

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

    let user = await userRepo.findOne({ googleId }) || await userRepo.findByEmail(email);
    const isNewUser = !user;

    if (isNewUser) {
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
      if (!user.isActive) throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);
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
    await Promise.all([
      userRepo.addRefreshToken(user.id, refreshToken),
      userRepo.updateById(user.id, { lastLogin: new Date() }),
    ]);

    if (req) {
      req.analyticsUserId = user.id;
      if (isNewUser) analytics.track(() => analytics.trackRegistration(req, user.id, email));
      const sessionId = await analytics.trackLogin(req, {
        userId: user.id, email, success: true, sessionToken: refreshToken,
      });
      req.analyticsSessionId = sessionId;
      if (sessionId && req.res) req.res.locals.analyticsSessionId = sessionId;
    }

    return { accessToken, refreshToken, user: user.toPublicJSON(), isNewUser };
  }
}

module.exports = new AuthService();
