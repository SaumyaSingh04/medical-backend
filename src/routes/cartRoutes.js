'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cartController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validations/cartValidation');

router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: item-uuid-001 }
 *         productId: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *         name: { type: string, example: Paracetamol 500mg }
 *         slug: { type: string, example: paracetamol-500mg }
 *         thumbnail: { type: string, nullable: true, example: 'https://res.cloudinary.com/demo/image/upload/product.jpg' }
 *         variantId: { type: string, nullable: true }
 *         variantName: { type: string, nullable: true, example: 500mg }
 *         variantSku: { type: string, nullable: true }
 *         quantity: { type: integer, minimum: 1, example: 2 }
 *         price: { type: number, example: 49.99 }
 *         compareAtPrice: { type: number, nullable: true, example: 69.99 }
 *         savedForLater: { type: boolean, example: false }
 *     Cart:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         couponCode: { type: string, nullable: true, example: SAVE10 }
 *         couponDiscount: { type: number, example: 50.00 }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/CartItem' }
 *         subtotal: { type: number, example: 249.95 }
 *         total: { type: number, example: 199.95 }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get current user cart
 *     description: Returns the cart with all items, applied coupon, and computed totals.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart with items and totals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { $ref: '#/components/schemas/Cart' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/', ctrl.getCart);

/**
 * @swagger
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add item to cart
 *     description: Adds a product (optionally a specific variant) to the cart. If item already exists, quantity is incremented.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *               variantId: { type: string, format: uuid, description: Optional variant ID for products with variants }
 *               quantity: { type: integer, minimum: 1, example: 2 }
 *     responses:
 *       200:
 *         description: Item added, returns updated cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Item added to cart. }
 *                 data: { $ref: '#/components/schemas/Cart' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Insufficient stock }
 *       401: { description: Unauthorized }
 *       404: { description: Product not found }
 */
router.post('/items', validate(v.addToCart), ctrl.addItem);

/**
 * @swagger
 * /cart/items/{itemId}:
 *   put:
 *     tags: [Cart]
 *     summary: Update cart item quantity
 *     description: Updates the quantity of a specific cart item. Set quantity to 0 to remove.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Cart item UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 0, example: 3 }
 *     responses:
 *       200:
 *         description: Cart updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cart updated. }
 *                 data: { $ref: '#/components/schemas/Cart' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Insufficient stock }
 *       401: { description: Unauthorized }
 *       404: { description: Cart item not found }
 */
router.put('/items/:itemId', validate(v.updateCartItem), ctrl.updateItem);

/**
 * @swagger
 * /cart/items/{itemId}:
 *   delete:
 *     tags: [Cart]
 *     summary: Remove item from cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Item removed, returns updated cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Item removed from cart. }
 *                 data: { $ref: '#/components/schemas/Cart' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Cart item not found }
 */
router.delete('/items/:itemId', ctrl.removeItem);

/**
 * @swagger
 * /cart:
 *   delete:
 *     tags: [Cart]
 *     summary: Clear entire cart
 *     description: Removes all items and clears any applied coupon.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cart cleared. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.delete('/', ctrl.clearCart);

/**
 * @swagger
 * /cart/coupon:
 *   post:
 *     tags: [Cart]
 *     summary: Apply coupon to cart
 *     description: Validates and applies a coupon code to the current cart. Replaces any previously applied coupon.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: SAVE10 }
 *     responses:
 *       200:
 *         description: Coupon applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Coupon applied. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     discountAmount: { type: number, example: 50.00 }
 *                     couponCode: { type: string, example: SAVE10 }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Invalid, expired, or minimum order not met }
 *       401: { description: Unauthorized }
 */
router.post('/coupon', validate(v.applyCoupon), ctrl.applyCoupon);

module.exports = router;
