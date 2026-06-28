'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { avatarUpload, handleMulterError } = require('../middleware/upload');
const v = require('../validations/userValidation');

// All user routes require authentication
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     Address:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: addr-uuid-001 }
 *         label: { type: string, example: Home }
 *         fullName: { type: string, example: Saumya Singh }
 *         phone: { type: string, example: '9876543210' }
 *         addressLine1: { type: string, example: 123 MG Road }
 *         addressLine2: { type: string, example: Near City Mall, nullable: true }
 *         city: { type: string, example: Mumbai }
 *         state: { type: string, example: Maharashtra }
 *         pincode: { type: string, example: '400001' }
 *         country: { type: string, example: India }
 *         isDefault: { type: boolean, example: true }
 *     UserProfile:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         firstName: { type: string, example: Saumya }
 *         lastName: { type: string, example: Singh }
 *         email: { type: string, format: email, example: saumya@example.com }
 *         phone: { type: string, example: '9876543210', nullable: true }
 *         role: { type: string, enum: [user, admin, super_admin], example: user }
 *         avatarUrl: { type: string, nullable: true, example: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg' }
 *         isEmailVerified: { type: boolean, example: true }
 *         isActive: { type: boolean, example: true }
 *         addresses:
 *           type: array
 *           items: { $ref: '#/components/schemas/Address' }
 *         wishlist:
 *           type: array
 *           items: { type: string, format: uuid }
 *           description: Array of product IDs
 *         lastLogin: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { $ref: '#/components/schemas/UserProfile' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/profile', ctrl.getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update current user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, minLength: 2, maxLength: 50, example: Saumya }
 *               lastName: { type: string, minLength: 2, maxLength: 50, example: Singh }
 *               phone: { type: string, example: '9876543210' }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Profile updated. }
 *                 data: { $ref: '#/components/schemas/UserProfile' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.put('/profile', validate(v.updateProfile), ctrl.updateProfile);

/**
 * @swagger
 * /users/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload profile avatar
 *     description: Uploads a new avatar image. Accepted formats — jpeg, png, webp. Max size 2MB.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar: { type: string, format: binary, description: Image file (jpeg/png/webp, max 2MB) }
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Avatar uploaded. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatarUrl: { type: string, example: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: No file uploaded or invalid format }
 *       401: { description: Unauthorized }
 */
router.post('/avatar', avatarUpload.single('avatar'), handleMulterError, ctrl.uploadAvatar);

/**
 * @swagger
 * /users/addresses:
 *   get:
 *     tags: [Users]
 *     summary: Get all saved addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Address' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/addresses', ctrl.getAddresses);

/**
 * @swagger
 * /users/addresses:
 *   post:
 *     tags: [Users]
 *     summary: Add a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, addressLine1, city, state, pincode]
 *             properties:
 *               label: { type: string, example: Home }
 *               fullName: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               addressLine1: { type: string, example: 123 MG Road }
 *               addressLine2: { type: string, example: Near City Mall }
 *               city: { type: string, example: Mumbai }
 *               state: { type: string, example: Maharashtra }
 *               pincode: { type: string, example: '400001' }
 *               isDefault: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Address added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Address added. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Address' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.post('/addresses', validate(v.addAddress), ctrl.addAddress);

/**
 * @swagger
 * /users/addresses/{addressId}:
 *   put:
 *     tags: [Users]
 *     summary: Update an address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Address UUID (stored in the JSON addresses array)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string, example: Office }
 *               fullName: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               addressLine1: { type: string, example: 456 Park Street }
 *               addressLine2: { type: string, example: Floor 2 }
 *               city: { type: string, example: Delhi }
 *               state: { type: string, example: Delhi }
 *               pincode: { type: string, example: '110001' }
 *               isDefault: { type: boolean }
 *     responses:
 *       200:
 *         description: Address updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Address updated. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Address' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Address not found }
 */
router.put('/addresses/:addressId', validate(v.updateAddress), ctrl.updateAddress);

/**
 * @swagger
 * /users/addresses/{addressId}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete an address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Address deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Address not found }
 */
router.delete('/addresses/:addressId', ctrl.deleteAddress);

/**
 * @swagger
 * /users/addresses/{addressId}/default:
 *   patch:
 *     tags: [Users]
 *     summary: Set address as default
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Default address updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Default address set. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Address' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Address not found }
 */
router.patch('/addresses/:addressId/default', ctrl.setDefaultAddress);

/**
 * @swagger
 * /users/wishlist:
 *   get:
 *     tags: [Users]
 *     summary: Get wishlist
 *     description: Returns the current user's wishlist with full product details.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId: { type: string, format: uuid }
 *                       addedAt: { type: string, format: date-time }
 *                       product: { $ref: '#/components/schemas/Product' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 */
router.get('/wishlist', ctrl.getWishlist);

/**
 * @swagger
 * /users/wishlist/{productId}:
 *   post:
 *     tags: [Users]
 *     summary: Toggle product in wishlist
 *     description: Adds the product if not in wishlist, removes it if already present.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID to add or remove
 *     responses:
 *       200:
 *         description: Wishlist updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Added to wishlist. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     action: { type: string, enum: [added, removed], example: added }
 *                     wishlist: { type: array, items: { type: string, format: uuid } }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Product not found }
 */
router.post('/wishlist/:productId', ctrl.toggleWishlist);

module.exports = router;
