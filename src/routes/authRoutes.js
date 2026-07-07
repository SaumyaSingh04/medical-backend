'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const v = require('../validations/authValidation');
const Joi = require('joi');
const verifyEmailQuery = Joi.object({ token: Joi.string().required() });

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and authorization
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthTokens:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     AuthUser:
 *       type: object
 *       description: Public user object returned in all auth responses (sensitive fields stripped)
 *       properties:
 *         id: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *         firstName: { type: string, example: Saumya }
 *         lastName: { type: string, example: Singh }
 *         email: { type: string, format: email, example: saumya@example.com }
 *         phone: { type: string, nullable: true, example: '9876543210' }
 *         role: { type: string, enum: [user, admin, super_admin], example: user }
 *         isEmailVerified: { type: boolean, example: false }
 *         isPhoneVerified: { type: boolean, example: false }
 *         isActive: { type: boolean, example: true }
 *         avatar:
 *           type: object
 *           nullable: true
 *           description: Present for Google OAuth users or users who uploaded a photo
 *           properties:
 *             url: { type: string, example: 'https://lh3.googleusercontent.com/a/photo.jpg' }
 *             publicId: { type: string, nullable: true, example: null }
 *         addresses:
 *           type: array
 *           description: Saved delivery addresses
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               fullName: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               addressLine1: { type: string, example: '123 Main St' }
 *               addressLine2: { type: string, nullable: true, example: Near Park }
 *               city: { type: string, example: Mumbai }
 *               state: { type: string, example: Maharashtra }
 *               pincode: { type: string, example: '400001' }
 *               isDefault: { type: boolean, example: true }
 *         lastLogin: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: |
 *       Creates a new user account and sends a verification email.
 *       - `phone` is required (Indian 10-digit number starting with 6-9)
 *       - Password must have at least one uppercase, one lowercase, and one digit
 *       - Optional address fields create a default saved address on signup
 *       - Email verification link is sent — login only works after verification
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, phone, password]
 *             properties:
 *               firstName: { type: string, minLength: 2, maxLength: 50, example: Saumya }
 *               lastName: { type: string, minLength: 2, maxLength: 50, example: Singh }
 *               email: { type: string, format: email, example: saumya@example.com }
 *               phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210' }
 *               password: { type: string, minLength: 8, maxLength: 72, example: SecurePass123 }
 *               address: { type: string, example: '123 Main Street', description: Optional — saved as default address }
 *               landmark: { type: string, example: Near Central Park }
 *               city: { type: string, example: Mumbai }
 *               state: { type: string, example: Maharashtra }
 *               pincode: { type: string, example: '400001' }
 *     responses:
 *       201:
 *         description: Registration successful — verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Registration successful. Please verify your email. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/AuthUser' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error — invalid phone, weak password etc. }
 *       409: { description: Email already registered }
 */
router.post('/register', authLimiter, validate(v.register), ctrl.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     description: |
 *       Authenticates user credentials and returns an access token.
 *       - `refreshToken` is set as an **httpOnly cookie** (not in response body)
 *       - Email must be verified before login is allowed
 *       - Account is locked for 30 min after 5 consecutive failed attempts
 *       - Google-only accounts (no password set) must use `POST /auth/google`
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: saumya@example.com }
 *               password: { type: string, example: SecurePass123 }
 *     responses:
 *       200:
 *         description: Login successful — refreshToken set as httpOnly cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Login successful. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *                     user: { $ref: '#/components/schemas/AuthUser' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Google-only account — must use Google sign-in }
 *       401: { description: Invalid email or password }
 *       403: { description: Email not verified or account deactivated }
 *       423: { description: Account locked after 5 failed attempts — retry after 30 min }
 */
router.post('/login', authLimiter, validate(v.login), ctrl.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     description: |
 *       Invalidates the refresh token and closes the exact active session tied to it.
 *       - Pass `refreshToken` in body if not using cookies
 *       - The httpOnly `refreshToken` cookie is cleared automatically
 *       - Session `isActive` is set to false and `logoutAt` is recorded
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: Required only if not sending via cookie }
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Logout successful. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Missing or invalid access token }
 */
router.post('/logout', authenticate, ctrl.logout);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Issues a new access token using a valid refresh token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Token refreshed. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh-token', validate(v.refreshToken), ctrl.refreshToken);

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email via token link
 *     description: Verifies the user's email address using the token sent in the verification email.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Email verification token from the email link
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Email verified successfully. }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid or expired token }
 */
router.get('/verify-email', validate(verifyEmailQuery, 'query'), ctrl.verifyEmail);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Send password reset email
 *     description: Sends a password reset link to the registered email address.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: saumya@example.com }
 *     responses:
 *       200:
 *         description: Reset email sent (returns success even if email not found, for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: If that email exists, a reset link has been sent. }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 */
router.post('/forgot-password', authLimiter, validate(v.forgotPassword), ctrl.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using token
 *     description: |
 *       Resets the user password using the token received in the password reset email.
 *       - Token is valid for 10 minutes
 *       - On success, **all refresh tokens are revoked** and **all active sessions are closed**
 *       - User must log in again on all devices after reset
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string, description: Password reset token from email link }
 *               password: { type: string, minLength: 8, maxLength: 72, example: NewSecurePass123, description: Must have uppercase, lowercase and a digit }
 *     responses:
 *       200:
 *         description: Password reset successful — all sessions invalidated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Password reset successful. }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid or expired token, or weak password }
 */
router.post('/reset-password', authLimiter, validate(v.resetPassword), ctrl.resetPassword);

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP via email or phone
 *     description: |
 *       Sends a 6-digit OTP to the user's registered email.
 *       - Pass either email address or registered phone number in `emailOrPhone`
 *       - OTP is valid for 10 minutes
 *       - Rate limited to 5 requests per 10 minutes
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailOrPhone]
 *             properties:
 *               emailOrPhone: { type: string, example: saumya@example.com, description: Email address or registered phone number }
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OTP sent successfully. }
 *                 timestamp: { type: string, format: date-time }
 *       404: { description: Account not found for given email or phone }
 *       429: { description: Too many OTP requests — try after 10 minutes }
 */
router.post('/send-otp', otpLimiter, validate(v.sendOTP), ctrl.sendOTP);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP
 *     description: |
 *       Verifies the OTP sent to the user's email or phone.
 *       - OTP expires after 10 minutes
 *       - Marks `isPhoneVerified: true` on success
 *       - Each wrong attempt is counted; too many wrong attempts may lock OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailOrPhone, otp]
 *             properties:
 *               emailOrPhone: { type: string, example: saumya@example.com, description: Same value used when sending OTP }
 *               otp: { type: string, minLength: 6, maxLength: 6, example: '123456' }
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OTP verified successfully. }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid or expired OTP }
 *       404: { description: Account not found }
 */
router.post('/verify-otp', otpLimiter, validate(v.verifyOTP), ctrl.verifyOTP);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Google OAuth login / register
 *     description: |
 *       Authenticate using a Google **id_token** obtained from the Google Sign-In SDK on the frontend.
 *
 *       **Flow:**
 *       1. Frontend gets `id_token` from Google Sign-In (e.g. `google.accounts.id.initialize`)
 *       2. Send `idToken` to this endpoint
 *       3. Backend verifies token with Google, finds or creates the user
 *       4. Returns access token in body + refresh token as httpOnly cookie
 *
 *       **Behaviour:**
 *       - New user → account auto-created, email pre-verified, returns `201` with `isNewUser: true`
 *       - Existing user (matched by googleId or email) → logs in, returns `200`
 *       - If existing account has no `googleId` yet → auto-linked
 *       - Inactive account → `403`
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google id_token from Google Sign-In SDK
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg...
 *     responses:
 *       200:
 *         description: Existing user logged in via Google
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Google login successful. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *                     isNewUser: { type: boolean, example: false }
 *                     user: { $ref: '#/components/schemas/AuthUser' }
 *                 timestamp: { type: string, format: date-time }
 *       201:
 *         description: New user account created via Google
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Account created via Google. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *                     isNewUser: { type: boolean, example: true }
 *                     user: { $ref: '#/components/schemas/AuthUser' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: idToken missing or Google verification failed }
 *       403: { description: Account is deactivated }
 *       500: { description: Google OAuth not configured on server }
 */
router.post('/google', authLimiter, ctrl.googleAuth);

module.exports = router;
