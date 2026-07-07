'use strict';

const Joi = require('joi');
const { id, quantity } = require('./common');

const addToCart = Joi.object({
  productId: id().required(),
  variantId: id().optional(),
  quantity:  quantity().required(),
});

const updateCartItem = Joi.object({
  quantity: Joi.number().integer().min(0).max(100).required(),
});

const applyCoupon = Joi.object({
  code: Joi.string().uppercase().trim().required(),
});

// productId comes from the video — only variantId + quantity are accepted from the body
const addToCartFromVideo = Joi.object({
  variantId: id().optional(),
  quantity:  quantity().default(1),
});

module.exports = { addToCart, updateCartItem, applyCoupon, addToCartFromVideo };
