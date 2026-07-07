'use strict';

const express = require('express');
const router = express.Router();
const ctrl          = require('../controllers/adminController');
const auditLogCtrl  = require('../controllers/auditLogController');
const exportCtrl    = require('../controllers/exportController');
const contactCtrl   = require('../controllers/contactController');
const notifCtrl     = require('../controllers/notificationController');
const { authenticate }      = require('../middleware/auth');
const { authorize }         = require('../middleware/authorize');
const { validate }          = require('../middleware/validate');
const { auditLog }          = require('../middleware/auditLog');
const { ROLES }             = require('../constants');
const ApiError              = require('../helpers/ApiError');
const contactValidation     = require('../validations/contactValidation');

const guardSuperAdminRole = (req, res, next) => {
  if (req.body.role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
    return next(ApiError.forbidden('Only super_admin can assign the super_admin role.'));
  }
  next();
};

const isSuperAdmin = authorize(ROLES.SUPER_ADMIN);
const isAdmin      = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

// CSRF protection is not required: all routes are protected by JWT Bearer token
// authentication (Authorization header). Browsers cannot send custom headers
// cross-origin without a preflight, making CSRF attacks impossible here.
router.use(authenticate);

/**
 * @swagger
 * /admin/analytics/revenue:
 *   get:
 *     tags: [Admin]
 *     summary: Revenue analytics (Super Admin)
 *     description: Returns total revenue, revenue by period, average order value, and revenue breakdown by payment method.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date, example: '2024-01-01' }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date, example: '2024-12-31' }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [daily, weekly, monthly], default: monthly }
 *     responses:
 *       200:
 *         description: Revenue analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number, example: 98450.50 }
 *                     averageOrderValue: { type: number, example: 450.25 }
 *                     revenueByPeriod: { type: array, items: { type: object } }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/revenue',           isSuperAdmin, ctrl.getRevenueAnalytics);

/**
 * @swagger
 * /admin/analytics/sales:
 *   get:
 *     tags: [Admin]
 *     summary: Sales analytics (Super Admin)
 *     description: Returns total sales count, sales by status, and sales trend over time.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [daily, weekly, monthly], default: monthly }
 *     responses:
 *       200:
 *         description: Sales analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSales: { type: integer, example: 218 }
 *                     salesByStatus: { type: object }
 *                     salesTrend: { type: array, items: { type: object } }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/sales',             isSuperAdmin, ctrl.getSalesAnalytics);

/**
 * @swagger
 * /admin/analytics/customers:
 *   get:
 *     tags: [Admin]
 *     summary: Customer analytics (Super Admin)
 *     description: Returns total customers, new customers, repeat customers, and top customers by order value.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Customer analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCustomers: { type: integer, example: 850 }
 *                     newCustomers: { type: integer, example: 120 }
 *                     repeatCustomers: { type: integer, example: 310 }
 *                     topCustomers: { type: array, items: { type: object } }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/customers',         isSuperAdmin, ctrl.getCustomerAnalytics);

/**
 * @swagger
 * /admin/analytics/orders:
 *   get:
 *     tags: [Admin]
 *     summary: Order analytics (Super Admin)
 *     description: Returns total orders, orders by status, cancellation rate, and return rate.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Order analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalOrders: { type: integer, example: 1240 }
 *                     ordersByStatus: { type: object }
 *                     cancellationRate: { type: number, example: 4.2 }
 *                     returnRate: { type: number, example: 1.8 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/orders',            isSuperAdmin, ctrl.getOrderAnalytics);

/**
 * @swagger
 * /admin/analytics/top-products:
 *   get:
 *     tags: [Admin]
 *     summary: Top selling products (Super Admin)
 *     description: Returns the top N products ranked by total units sold.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *         description: Number of top products to return
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Top products list
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
 *                       productId: { type: string, format: uuid }
 *                       name: { type: string, example: Paracetamol 500mg }
 *                       totalSold: { type: integer, example: 540 }
 *                       revenue: { type: number, example: 26946.60 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/top-products',      isSuperAdmin, ctrl.getTopProducts);

/**
 * @swagger
 * /admin/analytics/low-stock:
 *   get:
 *     tags: [Admin]
 *     summary: Low stock alerts (Super Admin)
 *     description: Returns products whose stock is at or below the given threshold.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema: { type: integer, default: 10, minimum: 0 }
 *         description: Stock quantity threshold — products at or below this value are returned
 *     responses:
 *       200:
 *         description: Products with low stock
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/low-stock',         isSuperAdmin, ctrl.getLowStockAlerts);

/**
 * @swagger
 * /admin/analytics/recent-activities:
 *   get:
 *     tags: [Admin]
 *     summary: Recent admin activities (Super Admin)
 *     description: Returns the most recent audit log entries for admin actions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
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
 *                       action: { type: string, example: create }
 *                       entity: { type: string, example: Product }
 *                       entityId: { type: string, nullable: true }
 *                       userId: { type: string, format: uuid }
 *                       createdAt: { type: string, format: date-time }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/analytics/recent-activities', isSuperAdmin, ctrl.getRecentActivities);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search by name or email
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin, super_admin] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/UserProfile' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/users',              isSuperAdmin, ctrl.listUsers);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Toggle user active status (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean, example: false }
 *     responses:
 *       200: { description: User status updated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 *       404: { description: User not found }
 */
router.patch('/users/:id/status', isSuperAdmin, auditLog('toggle_status', 'User'), ctrl.toggleUserStatus);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Update user role (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [user, admin, super_admin], example: admin }
 *     responses:
 *       200: { description: User role updated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 *       404: { description: User not found }
 */
router.patch('/users/:id/role', isSuperAdmin, guardSuperAdminRole, auditLog('update_role', 'User'), ctrl.updateUserRole);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Get audit logs (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Filter by action type
 *       - in: query
 *         name: entity
 *         schema: { type: string }
 *         description: Filter by entity type (e.g. Product, Order)
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated audit logs
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
 *                       action: { type: string, example: create }
 *                       entity: { type: string, example: Product }
 *                       entityId: { type: string, nullable: true }
 *                       userId: { type: string, format: uuid }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/audit-logs', isSuperAdmin, auditLogCtrl.getLogs);

/**
 * @swagger
 * /admin/export/orders:
 *   get:
 *     tags: [Admin]
 *     summary: Export orders as CSV (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/export/orders',   isSuperAdmin, exportCtrl.exportOrders);

/**
 * @swagger
 * /admin/export/users:
 *   get:
 *     tags: [Admin]
 *     summary: Export users as CSV (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/export/users',    isSuperAdmin, exportCtrl.exportUsers);

/**
 * @swagger
 * /admin/export/products:
 *   get:
 *     tags: [Admin]
 *     summary: Export products as CSV (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/export/products', isSuperAdmin, exportCtrl.exportProducts);

/**
 * @swagger
 * /admin/export/leads:
 *   get:
 *     tags: [Admin]
 *     summary: Export leads as CSV (Super Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Super Admin only }
 */
router.get('/export/leads',    isSuperAdmin, exportCtrl.exportLeads);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Admin dashboard summary
 *     description: Returns key metrics — total orders, revenue, users, products, recent orders, and low stock alerts.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalOrders: { type: integer, example: 1240 }
 *                     totalRevenue: { type: number, example: 98450.50 }
 *                     totalUsers: { type: integer, example: 850 }
 *                     totalProducts: { type: integer, example: 320 }
 *                     recentOrders: { type: array, items: { $ref: '#/components/schemas/Order' } }
 *                     lowStockProducts: { type: array, items: { $ref: '#/components/schemas/Product' } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/dashboard',      isAdmin, ctrl.getDashboard);

/**
 * @swagger
 * /admin/reports/sales:
 *   get:
 *     tags: [Admin]
 *     summary: Sales report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [daily, weekly, monthly], default: daily }
 *     responses:
 *       200: { description: Sales report data }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/reports/sales',  isAdmin, ctrl.getSalesReport);

// ─── Admin + Super Admin: Lead Management ────────────────────────────────────
// Lead management is served at /api/v1/leads (see leadRoutes.js)
// Both admin and super_admin have full access via the isAdminOrSuperAdmin guard there.

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: List all orders (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, processing, shipped, out_for_delivery, delivered, cancelled, return_requested, returned, refunded, failed] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search by order number or customer name
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated order list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Order' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/orders',              isAdmin, ctrl.listOrders);

/**
 * @swagger
 * /admin/orders/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update order status (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *                 enum: [confirmed, processing, shipped, out_for_delivery, delivered, cancelled, return_requested, returned, refunded]
 *                 example: shipped
 *               note: { type: string, maxLength: 500, example: Shipped via BlueDart. Tracking ID BD123456 }
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
 *       400: { description: Invalid status transition }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Order not found }
 */
router.patch('/orders/:id/status', isAdmin, auditLog('update_status', 'Order'), ctrl.updateOrderStatus);

/**
 * @swagger
 * /admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: List all products including inactive (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Paginated product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Product' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/products', isAdmin, ctrl.listProducts);

/**
 * @swagger
 * /admin/customers:
 *   get:
 *     tags: [Admin]
 *     summary: List customers (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Paginated customer list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/UserProfile' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/customers', isAdmin, ctrl.listCustomers);

/**
 * @swagger
 * /admin/contacts:
 *   get:
 *     tags: [Admin]
 *     summary: List contact queries (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, in_progress, resolved, closed] }
 *     responses:
 *       200:
 *         description: Paginated contact queries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/contacts',              isAdmin, contactCtrl.listContacts);

/**
 * @swagger
 * /admin/contacts/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update contact query status (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [open, in_progress, resolved, closed], example: resolved }
 *     responses:
 *       200: { description: Contact status updated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Contact not found }
 */
router.patch('/contacts/:id/status', isAdmin, validate(contactValidation.updateStatus), auditLog('update_status', 'Contact'), contactCtrl.updateContactStatus);

/**
 * @swagger
 * /admin/notifications/broadcast:
 *   post:
 *     tags: [Admin]
 *     summary: Broadcast notification to all users (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string, example: New Sale! }
 *               message: { type: string, example: Get 20% off on all medicines this weekend. }
 *               type: { type: string, enum: [general, order_placed, order_shipped], default: general }
 *               data: { type: object, description: Optional extra payload }
 *     responses:
 *       200:
 *         description: Notification broadcast successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notification broadcast sent. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sent: { type: integer, example: 850 }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.post('/notifications/broadcast', isAdmin, auditLog('broadcast', 'Notification'), notifCtrl.broadcastNotification);

module.exports = router;
