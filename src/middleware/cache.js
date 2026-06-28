'use strict';

const cacheService = require('../services/cacheService');

/**
 * Redis cache middleware factory.
 * Caches GET responses. Cache key is derived from the URL.
 * @param {number} ttl - Cache TTL in seconds
 * @param {function} keyFn - Optional custom key generator (req) => string
 */
const cache = (ttl, keyFn = null) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = keyFn ? keyFn(req) : `cache:${req.originalUrl}`;
    const cached = await cacheService.get(key);

    if (cached) {
      return res.status(200).json(cached);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body?.success) {
        cacheService.set(key, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = { cache };
