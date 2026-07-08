'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants');

router.use(authenticate, authorize(ROLES.ADMIN));

/**
 * @swagger
 * /analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Overall analytics summary
 *     description: Returns total users, new users (today/week/month), active sessions, login success/fail counts, and avg session duration.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Analytics summary }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers: { type: integer, example: 1240 }
 *                     newUsersToday: { type: integer, example: 12 }
 *                     newUsersThisWeek: { type: integer, example: 84 }
 *                     newUsersThisMonth: { type: integer, example: 320 }
 *                     activeUsersToday: { type: integer, example: 45 }
 *                     totalLogins: { type: integer, example: 5800 }
 *                     successfulLogins: { type: integer, example: 5600 }
 *                     failedLogins: { type: integer, example: 200 }
 *                     currentlyActiveUsers: { type: integer, example: 18 }
 *                     avgSessionDurationSeconds: { type: integer, example: 420 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/summary',              ctrl.getSummary);
/**
 * @swagger
 * /analytics/graph/logins:
 *   get:
 *     tags: [Analytics]
 *     summary: Login activity graph
 *     description: Returns login counts grouped by day/week/month for charting.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [daily, weekly, monthly], default: daily }
 *         description: Time grouping for the login history graph
 *     responses:
 *       200:
 *         description: Login graph data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       groupBy: { type: string, format: date-time }
 *                       total: { type: integer, example: 48 }
 *                       successful: { type: integer, example: 45 }
 *                       failed: { type: integer, example: 3 }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/graph/logins',         ctrl.getLoginGraph);          // ?groupBy=daily|weekly|monthly

/**
 * @swagger
 * /analytics/graph/registrations:
 *   get:
 *     tags: [Analytics]
 *     summary: User registration trend
 *     description: Returns daily registration counts for the last N days.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30, minimum: 1, maximum: 365 }
 *         description: Number of past days to include
 *     responses:
 *       200:
 *         description: Registration trend
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day: { type: string, format: date-time }
 *                       count: { type: integer, example: 12 }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/graph/registrations',  ctrl.getRegistrationTrend);   // ?days=30

/**
 * @swagger
 * /analytics/most-active-users:
 *   get:
 *     tags: [Analytics]
 *     summary: Most active users by action count
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Top active users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: string, format: uuid }
 *                       firstName: { type: string }
 *                       lastName: { type: string }
 *                       email: { type: string }
 *                       actions: { type: integer, example: 142 }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/most-active-users',    ctrl.getMostActiveUsers);

/**
 * @swagger
 * /analytics/recent-activities:
 *   get:
 *     tags: [Analytics]
 *     summary: Recent activity log entries
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: Recent activity entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       action: { type: string, example: order_create }
 *                       method: { type: string, example: POST }
 *                       endpoint: { type: string, example: /api/orders }
 *                       statusCode: { type: integer, example: 201 }
 *                       ipAddress: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       user:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           email: { type: string }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/recent-activities',    ctrl.getRecentActivities);

/**
 * @swagger
 * /analytics/login-history:
 *   get:
 *     tags: [Analytics]
 *     summary: Paginated login history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *         description: Filter by user UUID
 *       - in: query
 *         name: success
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Filter by login success/failure
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated login history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       userId: { type: string, nullable: true }
 *                       email: { type: string }
 *                       success: { type: boolean }
 *                       failReason: { type: string, nullable: true }
 *                       ipAddress: { type: string }
 *                       device: { type: string }
 *                       browser: { type: string }
 *                       os: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/login-history',        ctrl.getLoginHistory);

/**
 * @swagger
 * /analytics/registration-history:
 *   get:
 *     tags: [Analytics]
 *     summary: Paginated registration history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated registration history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       userId: { type: string, nullable: true }
 *                       email: { type: string }
 *                       ipAddress: { type: string }
 *                       device: { type: string }
 *                       browser: { type: string }
 *                       os: { type: string }
 *                       source: { type: string, example: web }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/registration-history', ctrl.getRegistrationHistory);

/**
 * @swagger
 * /analytics/activity-history:
 *   get:
 *     tags: [Analytics]
 *     summary: Paginated activity log
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: action
 *         schema: { type: string, example: order_create }
 *         description: Filter by action type
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated activity log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       userId: { type: string, nullable: true }
 *                       action: { type: string, example: order_create }
 *                       method: { type: string, example: POST }
 *                       endpoint: { type: string, example: /api/orders }
 *                       statusCode: { type: integer, example: 201 }
 *                       ipAddress: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       user:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           email: { type: string }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/activity-history',     ctrl.getActivityHistory);

/**
 * @swagger
 * /analytics/session-history:
 *   get:
 *     tags: [Analytics]
 *     summary: Paginated user session history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Filter active/inactive sessions
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated session history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       userId: { type: string, nullable: true }
 *                       ipAddress: { type: string }
 *                       device: { type: string }
 *                       browser: { type: string }
 *                       os: { type: string }
 *                       isActive: { type: boolean }
 *                       loginAt: { type: string, format: date-time }
 *                       logoutAt: { type: string, format: date-time, nullable: true }
 *                       durationSeconds: { type: integer, nullable: true }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/session-history',      ctrl.getSessionHistory);

/**
 * @swagger
 * /analytics/export:
 *   get:
 *     tags: [Analytics]
 *     summary: Export analytics data as CSV
 *     description: Downloads a CSV file of login, registration, session, or activity history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [login, registration, session, activity], default: activity }
 *         description: Type of history to export
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/export',               ctrl.exportHistory);          // ?type=login|registration|session|activity&format=csv

module.exports = router;
