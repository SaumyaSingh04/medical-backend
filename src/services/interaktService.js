'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

const getHeaders = () => {
  const key = process.env.INTERAKT_API_KEY;
  if (!key) throw new Error('INTERAKT_API_KEY not configured');
  return { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' };
};

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').trim();
  let countryCode = '91';
  if (p.startsWith('+91')) p = p.slice(3);
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  else if (p.startsWith('+')) {
    const m = p.match(/^\+(\d{1,3})(\d+)$/);
    if (m) { countryCode = m[1]; p = m[2]; }
    else p = p.slice(1);
  }
  return { countryCode: `+${countryCode}`, phoneNumber: p.slice(-10) };
}

/**
 * Send a WhatsApp template message via Interakt
 * @param {string} phone
 * @param {string} templateName  - pre-approved template name
 * @param {string[]} bodyValues  - ordered template variables
 * @param {string} languageCode
 */
const sendWhatsAppTemplate = async (phone, templateName, bodyValues = [], languageCode = 'en') => {
  if (!process.env.INTERAKT_API_KEY) {
    logger.warn('[Interakt] INTERAKT_API_KEY not set — skipping WhatsApp send');
    return null;
  }
  const { countryCode, phoneNumber } = normalizePhone(phone);
  const payload = {
    countryCode,
    phoneNumber,
    callbackData: 'medical_outbound',
    type: 'Template',
    template: { name: templateName, languageCode, bodyValues },
  };
  try {
    const { data } = await axios.post('https://api.interakt.ai/v1/public/message/', payload, { headers: getHeaders() });
    return data;
  } catch (err) {
    logger.error(`[Interakt] Template "${templateName}" failed for ${phone}:`, err?.response?.data || err.message);
    return null;
  }
};

// ─── Named message senders ────────────────────────────────────────────────────

/**
 * OTP via WhatsApp
 * Template variables: {{1}} = otp, {{2}} = expiry minutes
 */
const sendOtpWhatsApp = (phone, otp, expiryMinutes = 10) =>
  sendWhatsAppTemplate(
    phone,
    process.env.INTERAKT_OTP_TEMPLATE || 'otp_verification',
    [String(otp), String(expiryMinutes)]
  );

/**
 * Order Confirmed
 * Template variables: {{1}} = customerName, {{2}} = orderNumber, {{3}} = totalAmount
 */
const sendOrderConfirmed = (phone, customerName, orderNumber, totalAmount) =>
  sendWhatsAppTemplate(
    phone,
    process.env.INTERAKT_ORDER_CONFIRMED_TEMPLATE || 'order_confirmed',
    [customerName, String(orderNumber), String(totalAmount)]
  );

/**
 * Order Shipped
 * Template variables: {{1}} = customerName, {{2}} = orderNumber, {{3}} = trackingId
 */
const sendOrderShipped = (phone, customerName, orderNumber, trackingId = '') =>
  sendWhatsAppTemplate(
    phone,
    process.env.INTERAKT_ORDER_SHIPPED_TEMPLATE || 'order_shipped',
    [customerName, String(orderNumber), trackingId]
  );

/**
 * Order Delivered
 * Template variables: {{1}} = customerName, {{2}} = orderNumber
 */
const sendOrderDelivered = (phone, customerName, orderNumber) =>
  sendWhatsAppTemplate(
    phone,
    process.env.INTERAKT_ORDER_DELIVERED_TEMPLATE || 'order_delivered',
    [customerName, String(orderNumber)]
  );

/**
 * Lead Follow-up reminder
 * Template variables: {{1}} = customerName, {{2}} = agentName
 */
const sendLeadFollowUp = (phone, customerName, agentName = 'our team') =>
  sendWhatsAppTemplate(
    phone,
    process.env.INTERAKT_FOLLOWUP_TEMPLATE || 'lead_followup',
    [customerName, agentName]
  );

module.exports = {
  sendWhatsAppTemplate,
  sendOtpWhatsApp,
  sendOrderConfirmed,
  sendOrderShipped,
  sendOrderDelivered,
  sendLeadFollowUp,
};
