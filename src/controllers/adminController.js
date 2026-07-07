'use strict';

const adminService = require('../services/adminService');
const orderService = require('../services/orderService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, ROLES } = require('../constants');
const ApiError = require('../helpers/ApiError');

const clamp = (val, min, max, def) => Math.max(min, Math.min(max, parseInt(val, 10) || def));

// Factory for the four analytics handlers that share the same range/from/to signature
const analyticsHandler = (method) =>
  asyncHandler(async (req, res) => {
    const { range = 'thisMonth', from, to } = req.query;
    sendSuccess(res, MESSAGES.FETCHED, await adminService[method](range, from, to));
  });

const getDashboard = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await adminService.getDashboardStats());
});

const getRevenueAnalytics  = analyticsHandler('getRevenueAnalytics');
const getSalesAnalytics    = analyticsHandler('getSalesAnalytics');
const getCustomerAnalytics = analyticsHandler('getCustomerAnalytics');
const getOrderAnalytics    = analyticsHandler('getOrderAnalytics');

const getTopProducts = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await adminService.getTopProducts(clamp(req.query.limit, 1, 50, 10)));
});

const getLowStockAlerts = asyncHandler(async (req, res) => {
  const { threshold } = req.query;
  const parsed = parseInt(threshold, 10);
  if (threshold !== undefined && isNaN(parsed)) {
    throw ApiError.badRequest('threshold must be a non-negative integer.');
  }
  sendSuccess(res, MESSAGES.FETCHED, await adminService.getLowStockAlerts(Math.max(0, isNaN(parsed) ? 10 : parsed)));
});

const getRecentActivities = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await adminService.getRecentActivities(clamp(req.query.limit, 1, 100, 20)));
});

const getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  sendSuccess(res, MESSAGES.FETCHED, await adminService.getSalesReport(startDate, endDate));
});

const listUsers = asyncHandler(async (req, res) => {
  const { users, meta } = await adminService.listUsers(req.query);
  sendPaginated(res, MESSAGES.FETCHED, users, meta);
});

const listCustomers = asyncHandler(async (req, res) => {
  const { users, meta } = await adminService.listUsers({ ...req.query, role: ROLES.USER });
  sendPaginated(res, MESSAGES.FETCHED, users, meta);
});

const toggleUserStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.UPDATED, await adminService.toggleUserStatus(req.params.id));
});

const updateUserRole = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.UPDATED, await adminService.updateUserRole(req.params.id, req.body.role));
});

const listProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await adminService.listProducts(req.query);
  sendPaginated(res, MESSAGES.FETCHED, products, meta);
});

const listOrders = asyncHandler(async (req, res) => {
  const { orders, meta } = await adminService.listOrders(req.query);
  sendPaginated(res, MESSAGES.FETCHED, orders, meta);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.body.note, req.user.id);
  sendSuccess(res, MESSAGES.UPDATED, order);
});

module.exports = {
  getDashboard, getRevenueAnalytics, getSalesAnalytics, getCustomerAnalytics,
  getOrderAnalytics, getTopProducts, getLowStockAlerts, getRecentActivities,
  getSalesReport, listUsers, listCustomers, toggleUserStatus, updateUserRole,
  listProducts, listOrders, updateOrderStatus,
};
