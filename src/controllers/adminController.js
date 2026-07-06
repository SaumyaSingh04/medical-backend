'use strict';

const adminService = require('../services/adminService');
const orderService = require('../services/orderService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, ROLES } = require('../constants');

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  sendSuccess(res, MESSAGES.FETCHED, stats);
});

const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { range = 'thisMonth', from, to } = req.query;
  const data = await adminService.getRevenueAnalytics(range, from, to);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getSalesAnalytics = asyncHandler(async (req, res) => {
  const { range = 'thisMonth', from, to } = req.query;
  const data = await adminService.getSalesAnalytics(range, from, to);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const { range = 'thisMonth', from, to } = req.query;
  const data = await adminService.getCustomerAnalytics(range, from, to);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getOrderAnalytics = asyncHandler(async (req, res) => {
  const { range = 'thisMonth', from, to } = req.query;
  const data = await adminService.getOrderAnalytics(range, from, to);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getTopProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await adminService.getTopProducts(limit);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getLowStockAlerts = asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold, 10) || 10;
  const data = await adminService.getLowStockAlerts(threshold);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getRecentActivities = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const data = await adminService.getRecentActivities(limit);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

const getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const report = await adminService.getSalesReport(startDate, endDate);
  sendSuccess(res, MESSAGES.FETCHED, report);
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
  const user = await adminService.toggleUserStatus(req.params.id);
  sendSuccess(res, MESSAGES.UPDATED, user);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserRole(req.params.id, req.body.role);
  sendSuccess(res, MESSAGES.UPDATED, user);
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
