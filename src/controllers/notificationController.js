'use strict';

const notificationService = require('../services/notificationService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES } = require('../constants');

const getNotifications = asyncHandler(async (req, res) => {
  const { notifications, meta } = await notificationService.getUserNotifications(req.user.id, req.query);
  sendPaginated(res, MESSAGES.FETCHED, notifications, meta);
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.user.id, req.params.id);
  sendSuccess(res, 'Notification marked as read.', notification);
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  sendSuccess(res, 'All notifications marked as read.');
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, { unreadCount: count });
});

const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.user.id, req.params.id);
  sendSuccess(res, MESSAGES.DELETED);
});

const deleteAllNotifications = asyncHandler(async (req, res) => {
  await notificationService.deleteAllNotifications(req.user.id);
  sendSuccess(res, 'All notifications deleted.');
});

// Admin-only: broadcast a notification to all users or a specific user
const broadcastNotification = asyncHandler(async (req, res) => {
  const { title, message, type, data, actionUrl, targetUserId } = req.body;
  const result = await notificationService.broadcastNotification({ title, message, type, data, actionUrl, targetUserId });
  sendSuccess(res, `Notification sent to ${result.sent} user(s).`, result);
});

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount, deleteNotification, deleteAllNotifications, broadcastNotification };
