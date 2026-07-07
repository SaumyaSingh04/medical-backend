'use strict';

const rateLimit = require('express-rate-limit');
const { MESSAGES, HTTP_STATUS } = require('../constants');

// Top-level requires — fix lazy-load findings. Both modules are optional;
// if Redis is unavailable the limiter falls back to in-memory store.
let getRedisClient, RedisStore;
try {
  ({ getRedisClient } = require('../config/redis'));
  RedisStore = require('rate-limit-redis');
} catch (_) { /* Redis not available — in-memory fallback */ }

function makeStore(windowMs) {
  try {
    const client = getRedisClient?.();
    if (client?.status === 'ready') {
      return new RedisStore({ sendCommand: (...args) => client.call(...args), windowMs });
    }
  } catch (_) { /* fall through to in-memory */ }
  return undefined;
}

// In-memory fallback store for when Redis is unavailable
function memoryStore(windowMs) {
  const hits = new Map();
  return {
    async increment(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now > entry.resetTime) {
        hits.set(key, { totalHits: 1, resetTime: now + windowMs });
      } else {
        entry.totalHits++;
      }
      const { totalHits, resetTime } = hits.get(key);
      return { totalHits, resetTime: new Date(resetTime) };
    },
    async decrement(key) {
      const entry = hits.get(key);
      if (entry && entry.totalHits > 0) entry.totalHits--;
    },
    async resetKey(key) { hits.delete(key); },
  };
}

// Wraps makeStore in a lazy-init proxy so the store is resolved once on first
// use (after Redis has had time to connect) rather than at limiter construction.
function lazyStore(windowMs) {
  let resolved = false;
  let store;
  return {
    async increment(key) {
      if (!resolved) { store = makeStore(windowMs); resolved = true; }
      if (!store) { store = memoryStore(windowMs); }
      return store.increment(key);
    },
    async decrement(key) {
      if (!resolved) { store = makeStore(windowMs); resolved = true; }
      return store?.decrement?.(key);
    },
    async resetKey(key) {
      if (!resolved) { store = makeStore(windowMs); resolved = true; }
      return store?.resetKey?.(key);
    },
  };
}

const createLimiter = (options) => rateLimit({
  standardHeaders: true,
  legacyHeaders:   false,
  store:           lazyStore(options.windowMs),
  keyGenerator:    (req) => req.ip,
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success:     false,
      message:     MESSAGES.RATE_LIMIT,
      retryAfter:  Math.ceil(options.windowMs / 1000),
      timestamp:   new Date().toISOString(),
    });
  },
  ...options,
});

const generalLimiter  = createLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX,        10) || 100,
});

const authLimiter = createLimiter({
  windowMs:               15 * 60 * 1000,
  max:                    parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
  skipSuccessfulRequests: true,
});

const otpLimiter      = createLimiter({ windowMs: 10 * 60 * 1000, max: 5 });
const paymentLimiter  = createLimiter({ windowMs:      60 * 1000, max: 10 });
const publicFormLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

module.exports = { generalLimiter, authLimiter, otpLimiter, paymentLimiter, publicFormLimiter };
