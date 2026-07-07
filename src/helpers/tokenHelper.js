'use strict';

const jwt = require('jsonwebtoken');
const ApiError = require('./ApiError');
const { TOKEN_TYPE } = require('../constants');

const JWT_OPTIONS = {
  issuer:   'medical-ecommerce',
  audience: 'medical-client',
};

// Built once at module load — no per-call object reconstruction
const SECRETS = {
  [TOKEN_TYPE.ACCESS]:         () => process.env.JWT_ACCESS_SECRET,
  [TOKEN_TYPE.REFRESH]:        () => process.env.JWT_REFRESH_SECRET,
  [TOKEN_TYPE.RESET_PASSWORD]: () => process.env.JWT_RESET_PASSWORD_SECRET,
  [TOKEN_TYPE.EMAIL_VERIFY]:   () => process.env.JWT_EMAIL_VERIFY_SECRET,
};

const EXPIRIES = {
  [TOKEN_TYPE.ACCESS]:         () => process.env.JWT_ACCESS_EXPIRES_IN         || '15m',
  [TOKEN_TYPE.REFRESH]:        () => process.env.JWT_REFRESH_EXPIRES_IN        || '7d',
  [TOKEN_TYPE.RESET_PASSWORD]: () => process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '10m',
  [TOKEN_TYPE.EMAIL_VERIFY]:   () => process.env.JWT_EMAIL_VERIFY_EXPIRES_IN   || '24h',
};

const getSecret = (type) => {
  const fn = SECRETS[type];
  if (!fn) throw ApiError.internal(`Unknown token type: ${type}`);
  const secret = fn();
  if (!secret) throw ApiError.internal(`No secret configured for token type: ${type}`);
  return secret;
};

const generateToken = (payload, type = TOKEN_TYPE.ACCESS) => {
  return jwt.sign({ ...payload, tokenType: type }, getSecret(type), {
    ...JWT_OPTIONS,
    expiresIn: EXPIRIES[type](),
  });
};

const verifyToken = (token, type = TOKEN_TYPE.ACCESS) => {
  try {
    return jwt.verify(token, getSecret(type), JWT_OPTIONS);
  } catch (err) {
    if (err.name === 'TokenExpiredError')  throw ApiError.unauthorized('Token expired. Please log in again.');
    if (err.name === 'JsonWebTokenError')  throw ApiError.unauthorized('Invalid token.');
    throw ApiError.unauthorized('Token verification failed.');
  }
};

const generateAuthTokens = (userId, role) => {
  const payload = { userId, role };
  return {
    accessToken:  generateToken(payload, TOKEN_TYPE.ACCESS),
    refreshToken: generateToken(payload, TOKEN_TYPE.REFRESH),
  };
};

const extractBearerToken = (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
};

module.exports = { generateToken, verifyToken, generateAuthTokens, extractBearerToken };
