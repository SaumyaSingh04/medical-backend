'use strict';

const logger = require('../utils/logger');

// Query params that may carry sensitive values — redact before logging
const SENSITIVE_PARAMS = new Set(['token', 'password', 'email', 'otp', 'secret', 'key', 'apiKey', 'api_key']);

function redactUrl(originalUrl) {
  try {
    // originalUrl may be a path+query without a host; prepend a dummy base
    const url = new URL(originalUrl, 'http://x');
    let redacted = false;
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        url.searchParams.set(key, '[REDACTED]');
        redacted = true;
      }
    }
    return redacted ? url.pathname + url.search : originalUrl;
  } catch {
    return originalUrl;
  }
}

/**
 * Request logger middleware — logs method, URL (sensitive params redacted), status, and duration
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

    logger[level](`${req.method} ${redactUrl(req.originalUrl)} ${res.statusCode} - ${duration}ms`, {
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      userAgent: req.headers['user-agent'],
    });
  });

  next();
};

module.exports = { requestLogger };
