'use strict';

const { Queue, Worker } = require('bullmq');
const { sendEmail } = require('../utils/mailer');
const interaktService = require('../services/interaktService');
const logger = require('../utils/logger');
// Moved to top-level to fix lazy-load finding; isRedisConfigured/createBullMQConnection
// are safe to import early — they do not open a connection until called.
const { isRedisConfigured, createBullMQConnection, getRedisClient } = require('../config/redis');

const WHATSAPP_ALLOWED_TYPES = new Set([
  'sendOtpWhatsApp',
  'sendOrderConfirmed',
  'sendOrderShipped',
  'sendOrderDelivered',
  'sendLeadFollowUp',
]);

let emailQueue    = null;
let invoiceQueue  = null;
let whatsappQueue = null;

const workers         = [];
const bullConnections = [];

const defaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 200 },
};

function attachWorkerEvents(worker, name) {
  worker.on('completed', (job)      => logger.info(`[${name}] job ${job.id} completed.`));
  worker.on('failed',    (job, err) => logger.error(`[${name}] job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`));
  worker.on('stalled',   (jobId)    => logger.warn(`[${name}] job ${jobId} stalled — will be retried.`));
  worker.on('error',     (err)      => logger.error(`[${name}] worker error: ${err.message}`));
}

function newConnection() {
  const conn = createBullMQConnection();
  if (conn) bullConnections.push(conn);
  return conn;
}

// Factory: creates a Queue + Worker pair and registers the worker for shutdown
function makeQueue(name, jobOptions, processor, concurrency, extraWorkerOpts = {}) {
  const queue = new Queue(name, {
    connection:       newConnection(),
    defaultJobOptions: { ...defaultJobOptions, ...jobOptions },
  });
  const worker = new Worker(name, processor, {
    connection: newConnection(),
    concurrency,
    ...extraWorkerOpts,
  });
  attachWorkerEvents(worker, name.replace('-queue', ''));
  workers.push(worker);
  return queue;
}

const initializeJobs = () => {
  if (!isRedisConfigured() || !getRedisClient()) {
    logger.warn('Redis unavailable. Jobs will run synchronously (fallback mode).');
    return;
  }

  try {
    emailQueue = makeQueue(
      'email-queue',
      { attempts: 4, backoff: { type: 'exponential', delay: 2000 } },
      async (job) => sendEmail(job.data),
      parseInt(process.env.EMAIL_WORKER_CONCURRENCY, 10) || 5,
    );

    invoiceQueue = makeQueue(
      'invoice-queue',
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, delay: 1000 },
      async (job) => {
        // Intentional lazy-require: orderService → jobs creates a circular dependency
        // at module load time if required at the top level.
        const orderService = require('../services/orderService');
        await orderService.generateInvoice(job.data.orderId);
      },
      parseInt(process.env.INVOICE_WORKER_CONCURRENCY, 10) || 2,
      { lockDuration: 60000 },
    );

    whatsappQueue = makeQueue(
      'whatsapp-queue',
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
      async (job) => {
        const { type, phone, args } = job.data;
        if (!WHATSAPP_ALLOWED_TYPES.has(type)) throw new Error(`Blocked unknown WhatsApp job type: "${type}"`);
        await interaktService[type](phone, ...args);
      },
      parseInt(process.env.WHATSAPP_WORKER_CONCURRENCY, 10) || 3,
    );

    logger.info('✅ BullMQ job queues initialized (email, invoice, whatsapp).');
  } catch (err) {
    logger.warn(`BullMQ initialization failed: ${err.message}`);
  }
};

const shutdownJobs = async () => {
  logger.info('Closing BullMQ workers…');
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled(
    [emailQueue, invoiceQueue, whatsappQueue].filter(Boolean).map((q) => q.close())
  );
  await Promise.allSettled(
    bullConnections.filter((c) => c?.status === 'ready').map((c) => c.quit())
  );
  logger.info('BullMQ workers, queues, and connections closed.');
};

// ─── Public enqueue helpers ───────────────────────────────────────────────────

const addEmailJob = async (emailData, opts = {}) => {
  if (emailQueue) return emailQueue.add('send', emailData, opts);
  sendEmail(emailData).catch((err) => logger.warn(`[email fallback] ${err.message}`));
};

const addInvoiceJob = async (orderId, opts = {}) => {
  if (invoiceQueue) return invoiceQueue.add('generate', { orderId }, opts);
  logger.warn(`[invoice fallback] Redis unavailable — invoice for order ${orderId} skipped.`);
};

const addWhatsAppJob = async (type, phone, args = [], opts = {}) => {
  if (!phone) return;
  if (!WHATSAPP_ALLOWED_TYPES.has(type)) {
    logger.warn(`[whatsapp] Blocked unknown job type: "${type}"`);
    return;
  }
  if (whatsappQueue) return whatsappQueue.add('send', { type, phone, args }, opts);
  try {
    await interaktService[type](phone, ...args);
  } catch (err) {
    logger.warn(`[whatsapp fallback] ${type} failed: ${err.message}`);
  }
};

module.exports = { initializeJobs, shutdownJobs, addEmailJob, addInvoiceJob, addWhatsAppJob };
