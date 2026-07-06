'use strict';

const logger = require('../utils/logger');

let emailQueue = null;
let invoiceQueue = null;
let whatsappQueue = null;

const initializeJobs = () => {
  const { isRedisConfigured, getRedisClient } = require('../config/redis');
  if (!isRedisConfigured() || !getRedisClient()) {
    logger.warn('Redis unavailable. Jobs will run synchronously.');
    return;
  }

  try {
    const Bull = require('bull');
    const redisConfig = {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    };

    emailQueue = new Bull('email-queue', redisConfig);
    emailQueue.process(async (job) => {
      const { sendEmail } = require('../utils/mailer');
      await sendEmail(job.data);
    });
    emailQueue.on('completed', (job) => logger.info(`Email job ${job.id} completed.`));
    emailQueue.on('failed', (job, err) => logger.error(`Email job ${job.id} failed:`, err.message));

    invoiceQueue = new Bull('invoice-queue', redisConfig);
    invoiceQueue.process(async (job) => {
      const orderService = require('../services/orderService');
      await orderService.generateInvoice(job.data.orderId);
    });
    invoiceQueue.on('completed', (job) => logger.info(`Invoice job ${job.id} completed.`));
    invoiceQueue.on('failed', (job, err) => logger.error(`Invoice job ${job.id} failed:`, err.message));

    whatsappQueue = new Bull('whatsapp-queue', redisConfig);
    whatsappQueue.process(async (job) => {
      const interaktService = require('../services/interaktService');
      const { type, phone, args } = job.data;
      if (typeof interaktService[type] === 'function') {
        await interaktService[type](phone, ...args);
      }
    });
    whatsappQueue.on('completed', (job) => logger.info(`WhatsApp job ${job.id} completed.`));
    whatsappQueue.on('failed', (job, err) => logger.error(`WhatsApp job ${job.id} failed:`, err.message));

    logger.info('✅ Bull job queues initialized.');
  } catch (err) {
    logger.warn('Bull queue initialization failed:', err.message);
  }
};

const addEmailJob = async (emailData, opts = {}) => {
  if (emailQueue) {
    return emailQueue.add(emailData, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, ...opts });
  }
  const { sendEmail } = require('../utils/mailer');
  return sendEmail(emailData);
};

const addInvoiceJob = async (orderId, opts = {}) => {
  if (invoiceQueue) {
    return invoiceQueue.add({ orderId }, { attempts: 2, delay: 1000, ...opts });
  }
};

/**
 * Enqueue a WhatsApp send. Falls back to direct call when Redis is unavailable.
 * @param {string} type  - interaktService function name (e.g. 'sendOrderConfirmed')
 * @param {string} phone
 * @param {Array}  args  - remaining positional args after phone
 */
const addWhatsAppJob = async (type, phone, args = [], opts = {}) => {
  if (!phone) return;
  if (whatsappQueue) {
    return whatsappQueue.add({ type, phone, args }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, ...opts });
  }
  // Synchronous fallback
  try {
    const interaktService = require('../services/interaktService');
    if (typeof interaktService[type] === 'function') {
      await interaktService[type](phone, ...args);
    }
  } catch (err) {
    logger.warn(`[WhatsApp fallback] ${type} failed:`, err.message);
  }
};

module.exports = { initializeJobs, addEmailJob, addInvoiceJob, addWhatsAppJob };
