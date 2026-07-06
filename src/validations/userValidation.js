'use strict';

const Joi = require('joi');

const updateProfile = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  phone: Joi.string().allow('').pattern(/^[6-9]\d{9}$/).optional(),
  // email change requires a dedicated verify-new-email flow — not allowed here
  password: Joi.string().allow('').min(8).max(72).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).optional()
    .messages({ 'string.pattern.base': 'Password must have uppercase, lowercase, and a number.' }),
});

const addAddress = Joi.object({
  label: Joi.string().optional().default('Home'),
  fullName: Joi.string().trim().required(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  addressLine1: Joi.string().trim().required(),
  addressLine2: Joi.string().trim().optional(),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  pincode: Joi.string().pattern(/^\d{6}$/).required(),
  country: Joi.string().default('India').optional(),
  isDefault: Joi.boolean().default(false),
});

const updateAddress = addAddress.fork(Object.keys(addAddress.describe().keys), (s) => s.optional());

module.exports = { updateProfile, addAddress, updateAddress };
