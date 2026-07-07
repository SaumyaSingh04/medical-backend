'use strict';

const crypto = require('crypto');

const generateSecureToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const hmacSHA256 = (data, secret) =>
  crypto.createHmac('sha256', secret).update(data).digest('hex');

module.exports = { generateSecureToken, hmacSHA256 };
