'use strict';

const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  _client() { return getRedisClient(); }

  async get(key) {
    const client = this._client();
    if (!client) return null;
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn(`Cache GET error [${key}]:`, err.message);
      return null;
    }
  }

  async set(key, value, ttl = parseInt(process.env.REDIS_TTL, 10) || 3600) {
    const client = this._client();
    if (!client) return;
    try {
      await client.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      logger.warn(`Cache SET error [${key}]:`, err.message);
    }
  }

  async del(key) {
    const client = this._client();
    if (!client) return;
    try { await client.del(key); } catch (err) { logger.warn(`Cache DEL error [${key}]:`, err.message); }
  }

  async invalidatePattern(pattern) {
    const client = this._client();
    if (!client) return;
    try {
      const keys = await client.keys(pattern);
      if (!keys.length) return;
      // Delete in batches of 100 to avoid argument limit crashes
      for (let i = 0; i < keys.length; i += 100) {
        await client.del(...keys.slice(i, i + 100));
      }
    } catch (err) {
      logger.warn(`Cache invalidate pattern error [${pattern}]:`, err.message);
    }
  }

  async remember(key, ttl, fetchFn) {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }
}

module.exports = new CacheService();
