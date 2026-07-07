'use strict';

const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../helpers/ApiResponse');
const ApiError = require('../helpers/ApiError');
const leadService = require('../services/leadService');
const leadRepo = require('../repositories/leadRepo');
const { sendWhatsAppTemplate } = require('../services/interaktService');
const { HTTP_STATUS } = require('../constants');
const logger = require('../utils/logger');

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  else if (p.startsWith('+')) p = p.slice(1);
  return p.slice(-10);
}

function verifyWebhookSignature(req) {
  const secret = process.env.INTERAKT_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[Interakt Webhook] INTERAKT_WEBHOOK_SECRET not set — rejecting in production');
      return false;
    }
    return true;
  }
  const signature = req.headers['x-interakt-signature'];
  if (!signature) return false;
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function extractPhoneAndMessage(payload) {
  if (payload.type === 'message_received' && payload.data) {
    const customer = payload.data.customer || {};
    const phone = customer.phone_number || customer.phone;
    const customerName = customer.traits?.name || `WhatsApp Lead (${phone})`;
    const msgObj = payload.data.message || {};
    const messageText =
      (typeof msgObj.message === 'string' ? msgObj.message : null) ||
      msgObj.message?.text || msgObj.text || JSON.stringify(msgObj);
    return { phone, customerName, messageText };
  }
  const phone = payload.userPhoneNumber;
  return {
    phone,
    customerName: `WhatsApp Lead (${phone})`,
    messageText: payload.message?.text || payload.entity?.text || 'New WhatsApp message',
  };
}

const handleWebhook = asyncHandler(async (req, res) => {
  if (!verifyWebhookSignature(req)) {
    logger.warn('[Interakt Webhook] Invalid or missing signature — request rejected');
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Invalid signature' });
  }

  const payload = req.body;
  logger.info('[Interakt Webhook]', JSON.stringify(payload));

  // ACK immediately — Interakt retries on non-200
  res.status(HTTP_STATUS.OK).json({ success: true, message: 'Webhook received' });

  try {
    const isMessage = payload?.entityType === 'USER_MESSAGE' || payload?.type === 'message_received';
    if (!isMessage) return;

    const { phone, customerName, messageText } = extractPhoneAndMessage(payload);
    if (!phone || !messageText) return;

    const normalized = normalizePhone(phone);
    let lead = await leadRepo.findOne({ phone: normalized });

    if (!lead) {
      logger.info(`[Interakt Webhook] Auto-creating lead for ${normalized}`);
      try {
        lead = await leadService.createLead({
          name: customerName, phone: normalized,
          source: 'whatsapp', problem: `[WhatsApp] ${messageText}`, status: 'new',
        });
      } catch (err) {
        if (err.statusCode === 409) {
          lead = await leadRepo.findOne({ phone: normalized });
        } else {
          throw err;
        }
      }
    }

    if (lead) {
      await leadRepo.createNote({ leadId: lead.id, text: `[WhatsApp Inbound] ${messageText}`, direction: 'inbound' });
    }
  } catch (err) {
    logger.error('[Interakt Webhook Error]', err.message);
  }
});

const sendMessage = asyncHandler(async (req, res) => {
  const { leadId, templateName, bodyValues = [], languageCode = 'en', noteText } = req.body;
  if (!leadId || !templateName) throw ApiError.badRequest('leadId and templateName are required');

  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found');

  const result = await sendWhatsAppTemplate(lead.phone, templateName, bodyValues, languageCode);
  const text = noteText || `[WhatsApp Outbound] Template: ${templateName}`;
  await leadRepo.createNote({ leadId, text, direction: 'outbound', createdById: req.user?.id });

  return sendSuccess(res, 'Message sent', { interaktResult: result });
});

module.exports = { handleWebhook, sendMessage };
