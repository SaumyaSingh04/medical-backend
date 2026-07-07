'use strict';

const IORedis = require('ioredis');
const logger  = require('../utils/logger');

let redisClient = null;

const isRedisConfigured = () => !!(process.env.REDIS_URL || process.env.REDIS_HOST);

/**
 * Build shared ioredis config.
 * Supports REDIS_URL (e.g. rediss://…) and individual env vars.
 * TLS is enabled automatically when REDIS_TLS=true or the URL uses rediss://.
 */
const buildRedisConfig = () => {
  const tls = process.env.REDIS_TLS === 'true' ? { tls: {} } : {};

  if (process.env.REDIS_URL) {
    return { maxRetriesPerRequest: null, enableOfflineQueue: false, connectTimeout: 10000, ...tls };
  }

  return {
    host:                process.env.REDIS_HOST,
    port:                parseInt(process.env.REDIS_PORT, 10) || 6379,
    password:            process.env.REDIS_PASSWORD || undefined,
    db:                  parseInt(process.env.REDIS_DB, 10) || 0,
    maxRetriesPerRequest: null,
    enableOfflineQueue:  false,
    connectTimeout:      10000,
    ...tls,
  };
};

/** Create an ioredis instance using REDIS_URL or host/port config */
const createIORedis = (config = buildRedisConfig()) =>
  process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, config)
    : new IORedis(config);

const connectRedis = async () => {
  if (!isRedisConfigured()) {
    logger.warn('Redis env vars not set — running without cache/queues.');
    return;
  }

  try {
    const config = buildRedisConfig();
    const source = process.env.REDIS_URL || `${config.host}:${config.port}`;

    // Probe connection before committing — avoids noisy retry loops
    const probe = createIORedis({ ...config, maxRetriesPerRequest: 0, retryStrategy: () => null });
    probe.on('error', () => {});
    await probe.ping();
    probe.disconnect();

    redisClient = createIORedis(config);
    redisClient.on('ready',       ()   => logger.info(`✅ Redis connected (${source}).`));
    redisClient.on('error',       (err) => logger.warn(`Redis error: ${err.message}`));
    redisClient.on('reconnecting',(ms)  => logger.info(`Redis reconnecting in ${ms}ms…`));
    redisClient.on('close',       ()   => logger.warn('Redis connection closed.'));
  } catch (err) {
    logger.warn('Redis unavailable — app will run without cache/queues.');
    redisClient = null;
  }
};

const getRedisClient = () => redisClient;

/**
 * Create a fresh ioredis instance for BullMQ workers/queues.
 * BullMQ requires a dedicated connection per Queue/Worker.
 */
const createBullMQConnection = () => (isRedisConfigured() ? createIORedis() : null);

module.exports = { connectRedis, isRedisConfigured, getRedisClient, buildRedisConfig, createBullMQConnection };
