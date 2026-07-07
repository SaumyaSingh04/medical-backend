'use strict';

const orderService = require('../services/orderService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, HTTP_STATUS } = require('../constants');

const placeOrder = asyncHandler(async (req, res) => {
  const order = await orderService.placeOrder(req.user.id, req.body);
  sendSuccess(res, MESSAGES.ORDER_PLACED, order, HTTP_STATUS.CREATED);
});

const getUserOrders = asyncHandler(async (req, res) => {
  const { orders, meta } = await orderService.getUserOrders(req.user.id, req.query);
  sendPaginated(res, MESSAGES.FETCHED, orders, meta);
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user.id, req.user.role);
  sendSuccess(res, MESSAGES.FETCHED, order);
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.params.id, req.user.id, req.body.reason);
  sendSuccess(res, MESSAGES.ORDER_CANCELLED, order);
});

const requestReturn = asyncHandler(async (req, res) => {
  const order = await orderService.requestReturn(req.params.id, req.user.id, req.body.reason);
  sendSuccess(res, MESSAGES.RETURN_REQUESTED, order);
});

const getInvoice = asyncHandler(async (req, res) => {
  const result = await orderService.generateInvoice(req.params.id, req.user.id, req.user.role);
  sendSuccess(res, 'Invoice generated.', result);
});

const confirmCodOrder = asyncHandler(async (req, res) => {
  const result = await orderService.confirmCodOrder(req.params.id, req.user.id);
  sendSuccess(res, result.message, result.order);
});

module.exports = { placeOrder, getUserOrders, getOrder, cancelOrder, requestReturn, getInvoice, confirmCodOrder };
