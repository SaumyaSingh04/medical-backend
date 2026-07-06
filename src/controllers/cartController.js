'use strict';

const cartService = require('../services/cartService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES } = require('../constants');

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, cart);
});

const addItem = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user.id, req.body);
  sendSuccess(res, MESSAGES.CART_ITEM_ADDED, cart);
});

const updateItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateItem(req.user.id, req.params.itemId, req.body.quantity);
  sendSuccess(res, MESSAGES.CART_UPDATED, cart);
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, req.params.itemId);
  sendSuccess(res, MESSAGES.CART_ITEM_REMOVED, cart);
});

const clearCart = asyncHandler(async (req, res) => {
  await cartService.clearCart(req.user.id);
  sendSuccess(res, MESSAGES.CART_CLEARED);
});

const applyCoupon = asyncHandler(async (req, res) => {
  const result = await cartService.applyCoupon(req.user.id, req.body.code);
  sendSuccess(res, 'Coupon applied.', { cart: result.cart, discountAmount: result.discount });
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, applyCoupon };
