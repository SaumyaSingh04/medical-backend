'use strict';

const Joi = require('joi');
const { email, phone, password } = require('./common');

const register = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName:  Joi.string().trim().min(2).max(50).required(),
  email:     email().required(),
  phone:     phone().required(),
  password:  password().required(),
  address:   Joi.string().allow('').trim().optional(),
  pincode:   Joi.string().allow('').trim().optional(),
  landmark:  Joi.string().allow('').trim().optional(),
  city:      Joi.string().allow('').trim().optional(),
  state:     Joi.string().allow('').trim().optional(),
});

const login = Joi.object({
  email:    email().required(),
  password: Joi.string().required(),
});

const forgotPassword = Joi.object({
  email: email().required(),
});

const resetPassword = Joi.object({
  token:    Joi.string().required(),
  password: password().required(),
});

const sendOTP = Joi.object({
  emailOrPhone: Joi.string().required(),
});

const verifyOTP = Joi.object({
  emailOrPhone: Joi.string().required(),
  otp:          Joi.string().length(6).required(),
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = { register, login, forgotPassword, resetPassword, sendOTP, verifyOTP, refreshToken };
