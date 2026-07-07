'use strict';

const Joi = require('joi');
const { id, quantity } = require('./common');
const { PAYMENT_METHOD } = require('../constants');

const placeOrder = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: id().required(),
    variantId: id().optional(),
    quantity:  quantity().required(),
  })).min(1).max(50).required(),
  shippingAddressId: id().required(),
  paymentMethod:     Joi.string().valid(PAYMENT_METHOD.COD).required(),
  couponCode:        Joi.string().uppercase().trim().max(50).optional(),
  customerNote:      Joi.string().trim().max(500).optional(),
});

const updateStatus = Joi.object({
  status: Joi.string().required(),
  note:   Joi.string().optional(),
});

const cancelOrder = Joi.object({
  reason: Joi.string().min(3).max(500).optional(),
});

const returnOrder = Joi.object({
  reason: Joi.string().min(3).max(500).required(),
});

module.exports = { placeOrder, updateStatus, cancelOrder, returnOrder };
