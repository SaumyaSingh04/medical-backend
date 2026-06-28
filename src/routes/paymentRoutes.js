'use strict';

const express = require('express');
const router = express.Router();
// const ctrl = require('../controllers/paymentController');
// const { authenticate } = require('../middleware/auth');
// const { authorize } = require('../middleware/authorize');
// const { paymentLimiter } = require('../middleware/rateLimiter');
// const { ROLES } = require('../constants');

// ─── All payment routes commented out — only COD active ────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Payment processing — currently only COD is active. Razorpay & Stripe endpoints are disabled.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         orderId: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         gateway: { type: string, enum: [cod, razorpay, stripe], example: cod }
 *         amount: { type: number, example: 224.95 }
 *         currency: { type: string, example: INR }
 *         status:
 *           type: string
 *           enum: [pending, created, authorized, captured, paid, failed, refunded, partially_refunded, cancelled]
 *           example: paid
 *         gatewayOrderId: { type: string, nullable: true }
 *         gatewayPaymentId: { type: string, nullable: true }
 *         gatewaySignature: { type: string, nullable: true }
 *         failureReason: { type: string, nullable: true }
 *         refundId: { type: string, nullable: true }
 *         refundAmount: { type: number, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

// Razorpay Webhook
// router.post('/webhook/razorpay',
//   express.raw({ type: 'application/json' }),
//   (req, res, next) => { req.rawBody = req.body; next(); },
//   ctrl.razorpayWebhook
// );

// router.use(authenticate);

// router.post('/razorpay/verify', paymentLimiter, ctrl.verifyRazorpayPayment);
// router.post('/razorpay/fail/:orderId', paymentLimiter, ctrl.failRazorpayPayment);
// router.post('/razorpay/:orderId', paymentLimiter, ctrl.createRazorpayOrder);
// router.post('/stripe/:orderId', paymentLimiter, ctrl.createStripeIntent);
// router.post('/refund/:paymentId', authorize(ROLES.ADMIN), ctrl.initiateRefund);

module.exports = router;
