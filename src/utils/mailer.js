'use strict';

const { createTransporter } = require('../config/mailer');
const logger = require('./logger');

const OTP_EXPIRY = process.env.OTP_EXPIRY_MINUTES || 10;

const templates = {
  emailVerification: ({ name, verifyUrl }) => ({
    subject: 'Verify Your Email — Medical E-Commerce',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;">
      <h2 style="color:#2d3748;">Hello, ${name}!</h2>
      <p>Thank you for registering with Medical E-Commerce. Please verify your email to activate your account.</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;margin:16px 0;">Verify Email</a>
      <p style="color:#888;font-size:12px;">Link expires in 24 hours. If you didn't register, ignore this email.</p>
    </div>`,
  }),

  forgotPassword: ({ name, resetUrl }) => ({
    subject: 'Reset Your Password — Medical E-Commerce',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;">
      <h2 style="color:#2d3748;">Password Reset Request</h2>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:5px;margin:16px 0;">Reset Password</a>
      <p style="color:#888;font-size:12px;">Link expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>`,
  }),

  otp: ({ name, otp }) => ({
    subject: 'Your OTP — Medical E-Commerce',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;">
      <h2 style="color:#2d3748;">Your OTP</h2>
      <p>Hi ${name}, use the following OTP to verify your account:</p>
      <div style="font-size:36px;font-weight:bold;color:#4CAF50;letter-spacing:8px;padding:16px;text-align:center;">${otp}</div>
      <p style="color:#888;font-size:12px;">OTP expires in ${OTP_EXPIRY} minutes.</p>
    </div>`,
  }),

  orderPlaced: ({ name, orderNumber, totalAmount }) => ({
    subject: `Order Confirmed — #${orderNumber}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
      <h2>Thank you, ${name}!</h2>
      <p>Your order <strong>#${orderNumber}</strong> has been placed successfully.</p>
      <p>Total Amount: <strong>₹${totalAmount}</strong></p>
      <p>We'll notify you once your order is shipped.</p>
    </div>`,
  }),
};

const isSmtpConfigured = () => {
  const u = process.env.SMTP_USER;
  const p = process.env.SMTP_PASS;
  return u && !u.includes('your_') && p && !p.includes('your_');
};

/**
 * Send an email using a named template or raw html/subject.
 * @param {{ to: string, subject?: string, html?: string, template?: string, data?: object }} options
 */
const sendEmail = async ({ to, subject, html, template, data = {} }) => {
  if (!isSmtpConfigured()) {
    logger.warn(`[Mailer] SMTP not configured — skipping email to ${to}`);
    return;
  }

  try {
    const rendered = template && templates[template] ? templates[template](data) : null;
    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'Medical E-Commerce <noreply@medical-ecommerce.com>',
      to,
      subject: rendered?.subject ?? subject,
      html:    rendered?.html    ?? html,
    });
    logger.info(`Email sent to ${to}: ${rendered?.subject ?? subject}`);
  } catch (err) {
    logger.error(`Failed to send email to ${to}:`, err.message);
    // Don't throw — email failures shouldn't break request flow
  }
};

module.exports = { sendEmail };
