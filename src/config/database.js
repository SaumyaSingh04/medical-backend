'use strict';

const prisma = require('../repositories/prismaClient');
const logger = require('../utils/logger');

const RETRY_DELAY_MS     = 3000;
const KEEPALIVE_INTERVAL = 4 * 60 * 1000; // 4 min — Neon idles after 5 min

const NEON_TRANSIENT_CODES = ['E57P01', 'ECONNRESET', 'Connection is closed', 'terminating connection', 'Closed', 'closed'];

const isTransient = (err) =>
  NEON_TRANSIENT_CODES.some((c) => err?.message?.includes(c) || err?.code === c);

let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      if (isTransient(err)) {
        // Neon closed the connection — reconnect silently
        logger.warn('DB keep-alive: connection closed by Neon, reconnecting...');
        try {
          await prisma.$connect();
          logger.info('DB keep-alive: reconnected successfully.');
        } catch (reconnErr) {
          logger.warn('DB keep-alive: reconnect failed:', reconnErr.message);
        }
      } else {
        logger.warn('DB keep-alive ping failed:', err.message);
      }
    }
  }, KEEPALIVE_INTERVAL);
}

const connectDB = async (retries = 5) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      logger.info('✅ PostgreSQL connected via Prisma');
      if (process.env.NODE_ENV !== 'test') startKeepAlive();
      return;
    } catch (err) {
      const label = isTransient(err) ? 'transient error' : 'connection failed';
      logger.warn(`PostgreSQL ${label} (attempt ${i}/${retries}):`, err.message);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * i));
    }
  }
};

module.exports = { connectDB };
