'use strict';

const Joi = require('joi');
const { email, phone, password } = require('./common');

const updateProfile = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName:  Joi.string().trim().min(2).max(50).optional(),
  phone:     phone().allow('').optional(),
  // email change requires a dedicated verify-new-email flow — not allowed here
  // currentPassword is required when changing password to prevent account takeover
  currentPassword: Joi.string().when('password', {
    is:        Joi.string().min(1).exist(),
    then:      Joi.required(),
    otherwise: Joi.optional(),
  }),
  password: password().allow('').optional(),
});

const addAddress = Joi.object({
  label:        Joi.string().optional().default('Home'),
  fullName:     Joi.string().trim().required(),
  phone:        phone().required(),
  addressLine1: Joi.string().trim().required(),
  addressLine2: Joi.string().trim().optional(),
  city:         Joi.string().trim().optional(),   // auto-filled via pincode lookup
  state:        Joi.string().trim().optional(),   // auto-filled via pincode lookup
  pincode:      Joi.string().pattern(/^\d{6}$/).required(),
  country:      Joi.string().default('India').optional(),
  isDefault:    Joi.boolean().default(false),
});

const updateAddress = addAddress.fork(Object.keys(addAddress.describe().keys), (s) => s.optional());

module.exports = { updateProfile, addAddress, updateAddress };
