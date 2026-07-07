'use strict';

const Joi = require('joi');

// ── Reusable primitives ───────────────────────────────────────────────────────

const id       = () => Joi.string().uuid();
const email    = () => Joi.string().email().lowercase();
const phone    = () => Joi.string().pattern(/^[6-9]\d{9}$/)
  .messages({ 'string.pattern.base': 'Invalid Indian phone number.' });
const password = () => Joi.string().min(8).max(72).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({ 'string.pattern.base': 'Password must have uppercase, lowercase, and a number.' });
const quantity = () => Joi.number().integer().min(1).max(100);
const boolStr  = () => Joi.string().valid('true', 'false');
const isoDate  = () => Joi.string().isoDate();

const pagination = {
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

module.exports = { id, email, phone, password, quantity, boolStr, isoDate, pagination };
