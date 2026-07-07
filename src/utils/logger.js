'use strict';

const winston = require('winston');
const path = require('path');

const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
winston.addColors({ error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'blue' });

const logLevel = process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'warn' : process.env.NODE_ENV === 'test' ? 'error' : 'debug');

const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'accessToken', 'refreshToken', 'sessionToken',
  'otp', 'secret', 'apiKey', 'api_key', 'authorization', 'cookie',
  'creditCard', 'cardNumber', 'cvv',
]);

function scrubMeta(obj, depth = 0) {
  if (depth > 4 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrubMeta(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : scrubMeta(v, depth + 1);
  }
  return out;
}

const consoleFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const cleaned = scrubMeta(meta);
    const metaStr = Object.keys(cleaned).length ? `\n${JSON.stringify(cleaned, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}${stack ? `\n${stack}` : ''}`;
  })
);

const transports = [new winston.transports.Console({ format: consoleFormat })];

if (process.env.ENABLE_FILE_LOGS === 'true') {
  // Require at top of branch — module is only loaded when file logging is enabled,
  // but this runs once at startup (not inside a function), so it is not lazy-loading.
  const DailyRotateFile = require('winston-daily-rotate-file');
  const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
  const fileFormat = winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json()
  );
  const rotateBase = { datePattern: 'YYYY-MM-DD', maxSize: '20m', format: fileFormat, zippedArchive: true };

  transports.push(
    new DailyRotateFile({ ...rotateBase, filename: path.join(LOG_DIR, 'error-%DATE%.log'),    level: 'error', maxFiles: '30d' }),
    new DailyRotateFile({ ...rotateBase, filename: path.join(LOG_DIR, 'combined-%DATE%.log'),              maxFiles: '14d' })
  );
}

const logger = winston.createLogger({ level: logLevel, levels, transports, exitOnError: false });

module.exports = logger;
