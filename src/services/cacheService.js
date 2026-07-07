'use strict';

const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const DEFAULT_TTL = parseInt(process.env.REDIS_TTL, 10) || 3600;

/**
 * Safe JSON.parse — returns null on parse error.
 * Guards against prototype-pollution via __proto__ / prototype keys.
 */
function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if ('__proto__' in parsed || 'prototype' in parsed) {
        logger.warn('Cache: rejected value containing dangerous key.');
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function safeTtl(ttl) {
  return Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_TTL;
}

class CacheService {
  _client() {
    return getRedisClient();
  }

  async get(key) {
    const client = this._client();
    if (!client) return null;
    try {
      const data = await client.get(key);
      return data ? safeParse(data) : null;
    } catch (err) {
      logger.warn(`Cache GET error [${key}]: ${err.message}`);
      return null;
    }
  }

  async set(key, value, ttl = DEFAULT_TTL) {
    const client = this._client();
    if (!client) return;
    try {
      await client.set(key, JSON.stringify(value), 'EX', safeTtl(ttl));
    } catch (err) {
      logger.warn(`Cache SET error [${key}]: ${err.message}`);
    }
  }

  async del(key) {
    const client = this._client();
    if (!client) return;
    try {
      await client.del(key);
    } catch (err) {
      logger.warn(`Cache DEL error [${key}]: ${err.message}`);
    }
  }

  /**
   * Invalidate all keys matching a glob pattern using SCAN + pipelined DEL.
   */
  async invalidatePattern(pattern) {
    const client = this._client();
    if (!client) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) {
          const pipeline = client.pipeline();
          keys.forEach((k) => pipeline.del(k));
          await pipeline.exec();
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn(`Cache invalidatePattern error [${pattern}]: ${err.message}`);
    }
  }

  /**
   * Get-or-set: returns cached value if present, otherwise calls fetchFn,
   * caches the result, and returns it.
   */
  async remember(key, ttl, fetchFn) {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const data = await fetchFn();
    if (data !== null && data !== undefined) {
      await this.set(key, data, ttl);
    }
    return data;
  }

  /**
   * Batch get multiple keys in a single round-trip.
   */
  async mget(keys) {
    const client = this._client();
    if (!client || !keys.length) return keys.map(() => null);
    try {
      const values = await client.mget(keys);
      return values.map((v) => (v ? safeParse(v) : null));
    } catch (err) {
      logger.warn(`Cache MGET error: ${err.message}`);
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple key-value pairs with the same TTL using a pipeline.
   */
  async mset(entries, ttl = DEFAULT_TTL) {
    const client = this._client();
    if (!client || !entries.length) return;
    const t = safeTtl(ttl);
    try {
      const pipeline = client.pipeline();
      entries.forEach(({ key, value }) => pipeline.set(key, JSON.stringify(value), 'EX', t));
      await pipeline.exec();
    } catch (err) {
      logger.warn(`Cache MSET error: ${err.message}`);
    }
  }
}

module.exports = new CacheService();
