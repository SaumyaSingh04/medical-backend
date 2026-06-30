'use strict';

const Joi = require('joi');
const { PAYMENT_METHOD } = require('../constants');

const placeOrder = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    name: Joi.string().optional(),
    price: Joi.number().optional(),
    variantId: Joi.string().uuid().optional(),
    quantity: Joi.number().integer().min(1).required(),
  })).min(1).required(),
  shippingAddressId: Joi.string().required(),
  paymentMethod: Joi.string().valid(PAYMENT_METHOD.COD).required(),
  couponCode: Joi.string().uppercase().optional(),
  customerNote: Joi.string().max(500).optional(),
});

const updateStatus = Joi.object({
  status: Joi.string().required(),
  note: Joi.string().optional(),
});

const cancelOrder = Joi.object({
  reason: Joi.string().min(3).max(500).optional(),
});

const returnOrder = Joi.object({
  reason: Joi.string().min(3).max(500).required(),
});

module.exports = { placeOrder, updateStatus, cancelOrder, returnOrder };
