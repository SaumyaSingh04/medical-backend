'use strict';

const { notificationRepo } = require('../repositories');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');

class NotificationService {
  async createNotification(userId, { type, title, message, data, actionUrl }) {
    return notificationRepo.create({ user: userId, type, title, message, data, actionUrl });
  }

  async getUserNotifications(userId, queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const unreadOnly = queryParams.unreadOnly === 'true';
    const [notifications, total] = await Promise.all([
      notificationRepo.findUserNotifications(userId, skip, limit, unreadOnly),
      notificationRepo.count(unreadOnly ? { user: userId, isRead: false } : { user: userId }),
    ]);
    return { notifications, meta: buildPaginationMeta(total, page, limit) };
  }

  async markAsRead(userId, notificationId) {
    return notificationRepo.updateOne(
      { _id: notificationId, user: userId },
      { isRead: true, readAt: new Date() }
    );
  }

  async markAllRead(userId) {
    return notificationRepo.markAllRead(userId);
  }

  async getUnreadCount(userId) {
    return notificationRepo.unreadCount(userId);
  }

  async deleteNotification(userId, notificationId) {
    return notificationRepo.deleteOne({ _id: notificationId, user: userId });
  }

  async deleteAllNotifications(userId) {
    return notificationRepo.deleteAll(userId);
  }

  /**
   * Admin broadcast — send a notification to all active users (or a specific userId).
   * Mirrors XluxTrivenB's createNotification pattern but fan-out via Prisma createMany.
   */
  async broadcastNotification({ title, message, type = 'system', data = null, actionUrl = null, targetUserId = null }) {
    const userIds = targetUserId
      ? [targetUserId]
      : await notificationRepo.getActiveUserIds();
    await notificationRepo.createMany(userIds.map((userId) => ({ userId, type, title, message, data, actionUrl })));
    return { sent: userIds.length };
  }
}

module.exports = new NotificationService();
