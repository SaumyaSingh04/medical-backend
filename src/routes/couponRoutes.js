'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/couponController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants');
const { auditLog } = require('../middleware/auditLog');

/**
 * @swagger
 * components:
 *   schemas:
 *     Coupon:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         code: { type: string, example: SAVE10 }
 *         type: { type: string, enum: [percentage, flat, free_shipping, buy_x_get_y], example: percentage }
 *         value: { type: number, example: 10 }
 *         maxDiscount: { type: number, nullable: true, example: 200 }
 *         minOrderAmount: { type: number, example: 500 }
 *         description: { type: string, nullable: true, example: Get 10% off on orders above ₹500 }
 *         isActive: { type: boolean, example: true }
 *         startDate: { type: string, format: date-time }
 *         endDate: { type: string, format: date-time }
 *         usageLimit: { type: integer, nullable: true, example: 100 }
 *         usagePerUser: { type: integer, example: 1 }
 *         totalUsed: { type: integer, example: 42 }
 *         freeShipping: { type: boolean, example: false }
 *         applicableProducts: { type: array, items: { type: string, format: uuid } }
 *         applicableCategories: { type: array, items: { type: string, format: uuid } }
 *         excludedProducts: { type: array, items: { type: string, format: uuid } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /coupons/validate:
 *   post:
 *     tags: [Coupons]
 *     summary: Validate a coupon code
 *     description: Checks if a coupon is valid for the current cart. Optionally uses auth context to check per-user usage.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: SAVE10 }
 *               orderAmount: { type: number, description: Cart total to validate minimum order, example: 750 }
 *     responses:
 *       200:
 *         description: Coupon is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Coupon is valid. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     code: { type: string, example: SAVE10 }
 *                     type: { type: string, example: percentage }
 *                     value: { type: number, example: 10 }
 *                     maxDiscount: { type: number, nullable: true, example: 200 }
 *                     freeShipping: { type: boolean, example: false }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid, expired, or usage limit exceeded }
 */
router.post('/validate', optionalAuth, ctrl.validateCoupon);

router.use(authenticate, authorize(ROLES.ADMIN));

/**
 * @swagger
 * /coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: List all coupons (Admin)
 *     description: Returns all coupons including inactive ones. Admin only.
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
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: List of coupons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Coupon' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/', ctrl.listCoupons);

/**
 * @swagger
 * /coupons:
 *   post:
 *     tags: [Coupons]
 *     summary: Create a coupon (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, type, value, endDate]
 *             properties:
 *               code: { type: string, minLength: 3, maxLength: 100, example: SAVE10 }
 *               type: { type: string, enum: [percentage, flat, free_shipping, buy_x_get_y], example: percentage }
 *               value: { type: number, minimum: 0, example: 10 }
 *               maxDiscount: { type: number, minimum: 0, description: Max discount cap (for percentage type) }
 *               minOrderAmount: { type: number, minimum: 0, default: 0, example: 500 }
 *               description: { type: string, example: Get 10% off on orders above ₹500 }
 *               startDate: { type: string, format: date-time, description: Defaults to now }
 *               endDate: { type: string, format: date-time, example: '2025-12-31T23:59:59.000Z' }
 *               usageLimit: { type: integer, minimum: 1, description: Total uses allowed across all users }
 *               usagePerUser: { type: integer, default: 1, description: Max uses per user }
 *               isActive: { type: boolean, default: true }
 *               freeShipping: { type: boolean, default: false }
 *               applicableProducts: { type: array, items: { type: string, format: uuid } }
 *               applicableCategories: { type: array, items: { type: string, format: uuid } }
 *               excludedProducts: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: Coupon created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Coupon created. }
 *                 data: { $ref: '#/components/schemas/Coupon' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       409: { description: Coupon code already exists }
 */
router.post('/', auditLog('create', 'Coupon'), ctrl.createCoupon);

/**
 * @swagger
 * /coupons/{id}:
 *   put:
 *     tags: [Coupons]
 *     summary: Update a coupon (Admin)
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
 *             properties:
 *               isActive: { type: boolean }
 *               endDate: { type: string, format: date-time }
 *               usageLimit: { type: integer, minimum: 1 }
 *               maxDiscount: { type: number, minimum: 0 }
 *               minOrderAmount: { type: number, minimum: 0 }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Coupon updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Coupon updated. }
 *                 data: { $ref: '#/components/schemas/Coupon' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Coupon not found }
 */
router.put('/:id', auditLog('update', 'Coupon'), ctrl.updateCoupon);

/**
 * @swagger
 * /coupons/{id}:
 *   delete:
 *     tags: [Coupons]
 *     summary: Delete a coupon (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Coupon deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Coupon deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Coupon not found }
 */
router.delete('/:id', auditLog('delete', 'Coupon'), ctrl.deleteCoupon);

module.exports = router;
