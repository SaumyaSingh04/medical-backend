'use strict';

const Joi = require('joi');

const submitContact = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).optional().allow('', null)
    .messages({ 'string.pattern.base': 'Invalid Indian phone number.' }),
  subject: Joi.string().trim().min(3).max(200).required(),
  message: Joi.string().trim().min(10).max(2000).required(),
});

const updateStatus = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'resolved', 'closed').required(),
  adminNote: Joi.string().trim().max(1000).optional().allow('', null),
});

module.exports = { submitContact, updateStatus };
