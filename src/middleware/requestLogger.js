'use strict';

const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

// Query params that may carry sensitive values — redact before logging.
const SENSITIVE_PARAMS = new Set(['token', 'password', 'otp', 'secret', 'key', 'apiKey', 'api_key']);

// Paths that are too noisy to log at http level — downgrade to debug.
const SKIP_LOG_PATTERN = /\/(health|uploads)\b/;

function redactUrl(originalUrl) {
  try {
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

function truncateUserAgent(ua) {
  if (!ua) return null;
  return ua.length > 200 ? ua.slice(0, 200) + '…' : ua;
}

const requestLogger = (req, res, next) => {
  // Attach a unique request ID for distributed tracing.
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const start = Date.now();

  res.on('finish', () => {
    if (SKIP_LOG_PATTERN.test(req.originalUrl)) return;

    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';

    logger[level](`${req.method} ${redactUrl(req.originalUrl)} ${status} ${duration}ms`, {
      requestId: req.requestId,
      userId: req.user?.id ?? null,
      ip: req.ip,
      userAgent: truncateUserAgent(req.headers['user-agent']),
    });
  });

  next();
};

module.exports = { requestLogger };
