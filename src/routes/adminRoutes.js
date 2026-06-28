'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalUsers: { type: integer, example: 1240 }
 *         totalOrders: { type: integer, example: 580 }
 *         totalRevenue: { type: number, example: 125000.50 }
 *         totalProducts: { type: integer, example: 340 }
 *         pendingOrders: { type: integer, example: 42 }
 *         recentOrders:
 *           type: array
 *           items: { $ref: '#/components/schemas/Order' }
 *         recentUsers:
 *           type: array
 *           items: { $ref: '#/components/schemas/UserProfile' }
 *         lowStockProducts:
 *           type: array
 *           items: { $ref: '#/components/schemas/Product' }
 *     SalesReport:
 *       type: object
 *       properties:
 *         date: { type: string, format: date, example: '2024-06-01' }
 *         orders: { type: integer, example: 12 }
 *         revenue: { type: number, example: 4500.00 }
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard stats
 *     description: Returns summary stats — total users, orders, revenue, products, pending orders, recent orders/users, and low-stock products.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { $ref: '#/components/schemas/DashboardStats' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/dashboard', ctrl.getDashboard);

/**
 * @swagger
 * /admin/reports/sales:
 *   get:
 *     tags: [Admin]
 *     summary: Get sales report
 *     description: Returns daily sales (order count + revenue) grouped by date for a given date range.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date, example: '2024-01-01' }
 *         description: Start date (inclusive)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date, example: '2024-12-31' }
 *         description: End date (inclusive)
 *     responses:
 *       200:
 *         description: Sales grouped by day
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SalesReport' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Missing or invalid date range }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/reports/sales', ctrl.getSalesReport);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users
 *     description: Returns paginated list of all users. Supports search by name/email and filter by role.
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
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email (case-insensitive)
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin] }
 *         description: Filter by role
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/UserProfile' }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 1240 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 20 }
 *                         totalPages: { type: integer, example: 62 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/users', ctrl.listUsers);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Toggle user active/inactive
 *     description: Activates or deactivates a user account. Admins cannot deactivate themselves.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: User UUID
 *     responses:
 *       200:
 *         description: User status toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: User deactivated. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     isActive: { type: boolean, example: false }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: User not found }
 */
router.patch('/users/:id/status', ctrl.toggleUserStatus);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Update user role
 *     description: Changes a user's role. Super Admin only can assign admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: User UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [user, admin], example: admin }
 *     responses:
 *       200:
 *         description: Role updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Role updated. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     role: { type: string, example: admin }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid role }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: User not found }
 */
router.patch('/users/:id/role', ctrl.updateUserRole);

/**
 * @swagger
 * /admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: List all products including inactive (Admin)
 *     description: Returns paginated product list including inactive products. Supports search and filters.
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
 *         name: q
 *         schema: { type: string }
 *         description: Search by name or brand
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Filter by active status
 *       - in: query
 *         name: category
 *         schema: { type: string, format: uuid }
 *         description: Filter by category UUID
 *     responses:
 *       200:
 *         description: Paginated product list (all statuses)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 340 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 20 }
 *                         totalPages: { type: integer, example: 17 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/products', ctrl.listProducts);

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: List all orders (Admin)
 *     description: Returns paginated list of all orders across all users. Supports status filter.
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, out_for_delivery, delivered, cancelled, return_requested, returned, refunded, failed]
 *         description: Filter by order status
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *         description: Filter by user UUID
 *     responses:
 *       200:
 *         description: Paginated order list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 580 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 20 }
 *                         totalPages: { type: integer, example: 29 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/orders', ctrl.listOrders);

/**
 * @swagger
 * /admin/orders/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update order status (Admin)
 *     description: Updates the order status and appends an entry to the status history. Notifies the user via notification.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, processing, shipped, out_for_delivery, delivered, cancelled]
 *                 example: shipped
 *               note: { type: string, maxLength: 500, example: Dispatched via BlueDart. Tracking ID — BD123456 }
 *     responses:
 *       200:
 *         description: Order status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Order status updated. }
 *                 data: { $ref: '#/components/schemas/Order' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid status transition }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Order not found }
 */
router.patch('/orders/:id/status', ctrl.updateOrderStatus);

module.exports = router;
