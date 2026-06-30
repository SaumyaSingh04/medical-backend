'use strict';

const prisma = require('../repositories/prismaClient');
const logger = require('../utils/logger');

const NEON_TRANSIENT_CODES = ['E57P01', 'ECONNRESET', 'Connection is closed', 'terminating connection'];

const isTransient = (err) =>
  NEON_TRANSIENT_CODES.some((c) => err?.message?.includes(c) || err?.code === c);

const connectDB = async (retries = 5) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      logger.info('✅ PostgreSQL connected via Prisma');

      // Keep Neon alive — ping every 4 minutes (Neon idles after 5 min)
      if (process.env.NODE_ENV !== 'test') {
        setInterval(async () => {
          try {
            await prisma.$queryRaw`SELECT 1`;
          } catch (err) {
            if (!isTransient(err)) logger.warn('DB keep-alive ping failed:', err.message);
          }
        }, 4 * 60 * 1000);
      }

      return;
    } catch (err) {
      if (isTransient(err)) {
        logger.warn(`PostgreSQL transient error (attempt ${i}/${retries}), retrying...`);
      } else {
        logger.error(`PostgreSQL connection failed (attempt ${i}/${retries}):`, err.message);
      }
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
};

module.exports = { connectDB };
