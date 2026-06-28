'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validations/orderValidation');

router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productId: { type: string, format: uuid, nullable: true }
 *         name: { type: string, example: Paracetamol 500mg }
 *         slug: { type: string, example: paracetamol-500mg }
 *         thumbnail: { type: string, nullable: true }
 *         sku: { type: string, nullable: true }
 *         variantId: { type: string, nullable: true }
 *         variantName: { type: string, nullable: true }
 *         quantity: { type: integer, example: 2 }
 *         price: { type: number, example: 49.99 }
 *         compareAtPrice: { type: number, nullable: true, example: 69.99 }
 *         totalPrice: { type: number, example: 99.98 }
 *     ShippingAddress:
 *       type: object
 *       properties:
 *         fullName: { type: string, example: Saumya Singh }
 *         phone: { type: string, example: '9876543210' }
 *         addressLine1: { type: string, example: 123 MG Road }
 *         addressLine2: { type: string, nullable: true }
 *         city: { type: string, example: Mumbai }
 *         state: { type: string, example: Maharashtra }
 *         pincode: { type: string, example: '400001' }
 *         country: { type: string, example: India }
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         orderNumber: { type: string, example: ORD-20240101-0001 }
 *         userId: { type: string, format: uuid }
 *         status:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, out_for_delivery, delivered, cancelled, return_requested, returned, refunded, failed]
 *           example: pending
 *         paymentMethod: { type: string, enum: [cod, razorpay, stripe, wallet], example: cod }
 *         paymentStatus:
 *           type: string
 *           enum: [pending, created, authorized, captured, paid, failed, refunded, partially_refunded, cancelled]
 *           example: pending
 *         subtotal: { type: number, example: 249.95 }
 *         shippingCharge: { type: number, example: 0 }
 *         taxAmount: { type: number, example: 0 }
 *         discount: { type: number, example: 0 }
 *         couponCode: { type: string, nullable: true, example: SAVE10 }
 *         couponDiscount: { type: number, example: 25.00 }
 *         codConfirmationCharge: { type: number, example: 0 }
 *         totalAmount: { type: number, example: 224.95 }
 *         shippingAddress: { $ref: '#/components/schemas/ShippingAddress' }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/OrderItem' }
 *         statusHistory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               status: { type: string }
 *               note: { type: string, nullable: true }
 *               updatedBy: { type: string, nullable: true }
 *               timestamp: { type: string, format: date-time }
 *         invoiceNumber: { type: string, nullable: true }
 *         invoiceUrl: { type: string, nullable: true }
 *         customerNote: { type: string, nullable: true }
 *         cancellationReason: { type: string, nullable: true }
 *         returnReason: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place a new order
 *     description: Creates a new order from the provided items, validates stock, applies coupon, and saves the shipping address snapshot.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingAddressId, paymentMethod]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *                     variantId: { type: string, format: uuid, description: Required if product has variants }
 *                     quantity: { type: integer, minimum: 1, example: 2 }
 *               shippingAddressId: { type: string, format: uuid, description: UUID of a saved address }
 *               paymentMethod: { type: string, enum: [cod], example: cod }
 *               couponCode: { type: string, example: SAVE10 }
 *               customerNote: { type: string, maxLength: 500, example: Please deliver before 6pm }
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Order placed successfully. }
 *                 data: { $ref: '#/components/schemas/Order' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error or insufficient stock }
 *       401: { description: Unauthorized }
 *       404: { description: Product or address not found }
 */
router.post('/', validate(v.placeOrder), ctrl.placeOrder);

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get current user orders
 *     description: Returns paginated list of the authenticated user's orders, newest first.
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
 *           enum: [pending, confirmed, processing, shipped, out_for_delivery, delivered, cancelled, return_requested, returned]
 *         description: Filter by order status
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
 *                         total: { type: integer, example: 15 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 20 }
 *                         totalPages: { type: integer, example: 1 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/', ctrl.getUserOrders);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by ID
 *     description: Returns full order detail. Users can only access their own orders.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order UUID
 *     responses:
 *       200:
 *         description: Full order detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { $ref: '#/components/schemas/Order' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Order not found }
 */
router.get('/:id', ctrl.getOrder);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel an order
 *     description: Cancels the order if it is in `pending` or `confirmed` status. Stock is restored.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, maxLength: 500, example: Changed my mind }
 *     responses:
 *       200:
 *         description: Order cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Order cancelled. }
 *                 data: { $ref: '#/components/schemas/Order' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Order cannot be cancelled at this stage }
 *       401: { description: Unauthorized }
 *       404: { description: Order not found }
 */
router.post('/:id/cancel', validate(v.cancelOrder), ctrl.cancelOrder);

/**
 * @swagger
 * /orders/{id}/return:
 *   post:
 *     tags: [Orders]
 *     summary: Request return for a delivered order
 *     description: Submits a return request for a delivered order.
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 10, maxLength: 500, example: Product was damaged on arrival }
 *     responses:
 *       200:
 *         description: Return request submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Return request submitted. }
 *                 data: { $ref: '#/components/schemas/Order' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Order is not in delivered status }
 *       401: { description: Unauthorized }
 *       404: { description: Order not found }
 */
router.post('/:id/return', validate(v.returnOrder), ctrl.requestReturn);

/**
 * @swagger
 * /orders/{id}/invoice:
 *   get:
 *     tags: [Orders]
 *     summary: Get order invoice PDF URL
 *     description: Generates and returns a PDF invoice URL for the given order.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Invoice generated. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoiceUrl: { type: string, example: 'https://res.cloudinary.com/demo/raw/upload/invoice.pdf' }
 *                     invoiceNumber: { type: string, example: INV-20240101-0001 }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Order not found }
 */
router.get('/:id/invoice', ctrl.getInvoice);

/**
 * @swagger
 * /orders/{id}/cod-confirm:
 *   post:
 *     tags: [Orders]
 *     summary: Confirm COD order
 *     description: Confirms a Cash on Delivery order by paying the ₹100 COD confirmation charge. Only applicable for unconfirmed COD orders.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: COD order confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: COD order confirmed. }
 *                 data: { $ref: '#/components/schemas/Order' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Not a COD order or already confirmed }
 *       401: { description: Unauthorized }
 *       404: { description: Order not found }
 */
router.post('/:id/cod-confirm', ctrl.confirmCodOrder);

module.exports = router;
