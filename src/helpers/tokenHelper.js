'use strict';

const jwt = require('jsonwebtoken');
const ApiError = require('./ApiError');
const { TOKEN_TYPE } = require('../constants');

const SECRETS = {
  [TOKEN_TYPE.ACCESS]: process.env.JWT_ACCESS_SECRET,
  [TOKEN_TYPE.REFRESH]: process.env.JWT_REFRESH_SECRET,
  [TOKEN_TYPE.RESET_PASSWORD]: process.env.JWT_RESET_PASSWORD_SECRET,
  [TOKEN_TYPE.EMAIL_VERIFY]: process.env.JWT_EMAIL_VERIFY_SECRET,
};

const EXPIRIES = {
  [TOKEN_TYPE.ACCESS]: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  [TOKEN_TYPE.REFRESH]: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  [TOKEN_TYPE.RESET_PASSWORD]: process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '10m',
  [TOKEN_TYPE.EMAIL_VERIFY]: process.env.JWT_EMAIL_VERIFY_EXPIRES_IN || '24h',
};

/**
 * Generate a JWT token
 * @param {object} payload - Token payload
 * @param {string} type - Token type (from TOKEN_TYPE)
 * @returns {string} signed JWT
 */
const generateToken = (payload, type = TOKEN_TYPE.ACCESS) => {
  const secret = SECRETS[type];
  if (!secret) throw ApiError.internal(`No secret configured for token type: ${type}`);

  return jwt.sign({ ...payload, tokenType: type }, secret, {
    expiresIn: EXPIRIES[type],
    issuer: 'medical-ecommerce',
    audience: 'medical-client',
  });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT string
 * @param {string} type - Token type (from TOKEN_TYPE)
 * @returns {object} Decoded payload
 */
const verifyToken = (token, type = TOKEN_TYPE.ACCESS) => {
  const secret = SECRETS[type];
  if (!secret) throw ApiError.internal(`No secret configured for token type: ${type}`);

  try {
    return jwt.verify(token, secret, {
      issuer: 'medical-ecommerce',
      audience: 'medical-client',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired. Please log in again.');
    }
    if (err.name === 'JsonWebTokenError') {
      throw ApiError.unauthorized('Invalid token.');
    }
    throw ApiError.unauthorized('Token verification failed.');
  }
};

/**
 * Generate access + refresh token pair
 */
const generateAuthTokens = (userId, role) => {
  const payload = { userId, role };
  const accessToken = generateToken(payload, TOKEN_TYPE.ACCESS);
  const refreshToken = generateToken(payload, TOKEN_TYPE.REFRESH);
  return { accessToken, refreshToken };
};

/**
 * Extract raw token from Authorization header
 */
const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
};

module.exports = { generateToken, verifyToken, generateAuthTokens, extractBearerToken };
