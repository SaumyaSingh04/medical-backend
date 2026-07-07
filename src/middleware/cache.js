'use strict';

const cacheService = require('../services/cacheService');
const crypto = require('crypto');

// SHA-256 is collision-resistant; SHA-1 (CWE-327/328) must not be used here.
function makeEtag(serialised) {
  return `W/"${crypto.createHash('sha256').update(serialised).digest('hex')}"`;
}

/**
 * Redis cache middleware factory.
 * - Only caches successful GET responses (status 200, success: true).
 * - Skips caching for authenticated requests unless a custom keyFn is provided.
 * - Adds a weak ETag for conditional GET (304 Not Modified).
 * - Never throws — Redis failures fall through silently.
 */
const cache = (ttl, keyFn = null) => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (!keyFn && (req.headers.authorization || req.cookies?.accessToken)) return next();

  const key = keyFn ? keyFn(req) : `cache:${req.originalUrl}`;

  try {
    const cached = await cacheService.get(key);
    if (cached) {
      const etag = makeEtag(JSON.stringify(cached));
      if (req.headers['if-none-match'] === etag) return res.status(304).end();
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('ETag', etag);
      return res.status(200).json(cached);
    }
  } catch { /* Redis unavailable — fall through */ }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body?.success) {
      const serialised = JSON.stringify(body);
      const etag = makeEtag(serialised);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('ETag', etag);
      cacheService.set(key, body, ttl).catch(() => {});
    }
    return originalJson(body);
  };

  next();
};

module.exports = { cache };
