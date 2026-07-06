'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         type:
 *           type: string
 *           enum: [order_placed, order_confirmed, order_shipped, order_delivered, order_cancelled, return_requested, return_approved, payment_success, payment_failed, review_reply, general]
 *           example: order_shipped
 *         title: { type: string, example: Your order has been shipped }
 *         message: { type: string, example: 'Order ORD-20240101-0001 has been shipped via BlueDart. Tracking ID: BD123456' }
 *         isRead: { type: boolean, example: false }
 *         data: { type: object, nullable: true, description: Extra payload (e.g. orderId) }
 *         createdAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     description: Returns paginated notifications for the authenticated user, newest first.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *         description: When true, returns only unread notifications
 *     responses:
 *       200:
 *         description: Paginated notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Notification' }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 45 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 20 }
 *                         totalPages: { type: integer, example: 3 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/', ctrl.getNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     description: Returns the count of unread notifications for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount: { type: integer, example: 7 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/unread-count', ctrl.getUnreadCount);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: All marked as read. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.patch('/read-all', ctrl.markAllRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Notification UUID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Marked as read. }
 *                 data: { $ref: '#/components/schemas/Notification' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Notification not found }
 */
router.patch('/:id/read', ctrl.markRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Notification UUID
 *     responses:
 *       200:
 *         description: Notification deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notification deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Notification not found }
 */
router.delete('/:id', ctrl.deleteNotification);

/**
 * @swagger
 * /notifications:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete all notifications
 *     description: Deletes all notifications for the authenticated user. Mirrors XluxTrivenB DELETE /.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: All notifications deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.delete('/', ctrl.deleteAllNotifications);

module.exports = router;
