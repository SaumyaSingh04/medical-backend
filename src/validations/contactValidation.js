'use strict';

const Joi = require('joi');
const { email, phone } = require('./common');

const submitContact = Joi.object({
  name:    Joi.string().trim().min(2).max(100).required(),
  email:   email().required(),
  phone:   phone().allow('', null).optional(),
  subject: Joi.string().trim().min(3).max(200).required(),
  message: Joi.string().trim().min(10).max(2000).required(),
});

const updateStatus = Joi.object({
  status:    Joi.string().valid('pending', 'in_progress', 'resolved', 'closed').required(),
  adminNote: Joi.string().trim().max(1000).allow('', null).optional(),
});

module.exports = { submitContact, updateStatus };
