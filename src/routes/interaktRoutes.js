'use strict';

const express = require('express');
const router = express.Router();
const { handleWebhook, sendMessage } = require('../controllers/interaktController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants');

// Webhook — no auth (Interakt calls this)

/**
 * @swagger
 * /interakt/webhook:
 *   post:
 *     tags: [Interakt]
 *     summary: Interakt WhatsApp webhook receiver
 *     description: Receives incoming WhatsApp messages and events from Interakt. No authentication required — called by Interakt servers.
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Interakt webhook payload
 *     responses:
 *       200: { description: Webhook received }
 *   get:
 *     tags: [Interakt]
 *     summary: Interakt webhook verification
 *     description: Webhook URL verification endpoint used by Interakt during setup.
 *     security: []
 *     responses:
 *       200: { description: OK }
 */
router.post('/webhook', handleWebhook);
router.get('/webhook', (req, res) => res.status(200).send('OK'));

/**
 * @swagger
 * /interakt/send:
 *   post:
 *     tags: [Interakt]
 *     summary: Send a WhatsApp message via Interakt (Admin)
 *     description: Manually sends a WhatsApp message to a phone number using the Interakt API. Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, message]
 *             properties:
 *               phone: { type: string, example: '9876543210', description: Recipient phone number (Indian 10-digit) }
 *               message: { type: string, example: Your order has been shipped! }
 *               templateName: { type: string, description: Optional Interakt template name }
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Message sent. }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.post('/send', authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), sendMessage);

module.exports = router;
