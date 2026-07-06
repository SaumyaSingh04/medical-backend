'use strict';

const logger = require('../utils/logger');

let redisClient = null;

const isRedisConfigured = () => !!process.env.REDIS_HOST;

const connectRedis = async () => {
  if (!isRedisConfigured()) {
    logger.warn('Redis env vars not set. Running without cache/queues.');
    return;
  }

  try {
    const IORedis = require('ioredis');
    let connected = false;

    redisClient = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB, 10) || 0,
      retryStrategy: (times) => {
        if (!connected) return null;
        if (times > 10) {
          logger.warn('Redis max retries reached. Operating without cache.');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('ready', () => { connected = true; logger.info('✅ Redis connected.'); });
    redisClient.on('error', (err) => { logger.warn(`Redis error: ${err.message}`); });

    await redisClient.connect();
  } catch (err) {
    logger.warn(`Redis unavailable. App will run without caching: ${err.message}`);
    if (redisClient) { redisClient.disconnect(); redisClient = null; }
  }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, isRedisConfigured, getRedisClient };
