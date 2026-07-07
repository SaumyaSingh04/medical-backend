'use strict';

require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  const REQUIRED_SECRETS = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_RESET_PASSWORD_SECRET',
    'JWT_EMAIL_VERIFY_SECRET',
    'COOKIE_SECRET',
    'DATABASE_URL',
  ];
  const PLACEHOLDER = 'CHANGE_ME';
  const missing = REQUIRED_SECRETS.filter(
    (k) => !process.env[k] || process.env[k].includes(PLACEHOLDER)
  );
  if (missing.length) {
    console.error(`[FATAL] Missing or placeholder secrets in production: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.ENABLE_DEV_ROUTES === 'true') {
    console.error('[FATAL] ENABLE_DEV_ROUTES must not be true in production.');
    process.exit(1);
  }
}

const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const { connectRedis, getRedisClient } = require('./src/config/redis');
const { initializeJobs, shutdownJobs } = require('./src/jobs');
const { initializeSockets } = require('./src/sockets');
const prisma = require('./src/repositories/prismaClient');
const logger = require('./src/utils/logger');

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const PORT    = process.env.PORT    || 5000;
const APP_NAME = process.env.APP_NAME || 'Medical E-Commerce API';

const server = http.createServer(app);
initializeSockets(server);

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Initiating graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error('Error during server close', { error: err.message });
      process.exit(1);
    }

    try {
      await shutdownJobs();

      await prisma.$disconnect();
      logger.info('Prisma connection closed.');

      const redisClient = getRedisClient();
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.quit();
        logger.info('Redis connection closed.');
      }

      logger.info(`${APP_NAME} shut down gracefully.`);
      process.exit(0);
    } catch (shutdownErr) {
      logger.error('Error during graceful shutdown', { error: shutdownErr.message });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forcing shutdown after 30s timeout.');
    process.exit(1);
  }, 30000).unref();
};

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack   = reason instanceof Error ? reason.stack   : undefined;
  logger.error('Unhandled Promise Rejection', { message, stack });
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

const bootstrap = async () => {
  try {
    await connectDB();
    await connectRedis();
    initializeJobs();

    server.listen(PORT, () => {
      logger.info(`🚀 ${APP_NAME} running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api/v1/docs`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

bootstrap();
