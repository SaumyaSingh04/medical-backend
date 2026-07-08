'use strict';

const express = require('express');
const router = express.Router();

const videoController = require('../controllers/videoController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { videoUpload } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const { addToCartFromVideo } = require('../validations/cartValidation');
const { ROLES } = require('../constants');

const isAdmin = authorize(ROLES.ADMIN);
const videoFields = videoUpload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

/**
 * @swagger
 * components:
 *   schemas:
 *     VideoProduct:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         name:
 *           type: string
 *           example: Paracetamol 500mg
 *         slug:
 *           type: string
 *           example: paracetamol-500mg
 *         price:
 *           type: number
 *           example: 49.99
 *         compareAtPrice:
 *           type: number
 *           nullable: true
 *           example: 69.99
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *           example: https://res.cloudinary.com/demo/image/upload/product.jpg
 *         stock:
 *           type: integer
 *           example: 100
 *         isActive:
 *           type: boolean
 *           example: true
 *         hasVariants:
 *           type: boolean
 *           example: false
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *           example: []
 *
 *     HomeVideo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *         title:
 *           type: string
 *           example: Best Selling Paracetamol
 *         videoUrl:
 *           type: string
 *           example: https://res.cloudinary.com/demo/video/upload/sample.mp4
 *         videoPublicId:
 *           type: string
 *           nullable: true
 *           example: medical-ecommerce/home-videos/sample
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *           example: https://res.cloudinary.com/demo/image/upload/thumb.jpg
 *         thumbnailPublicId:
 *           type: string
 *           nullable: true
 *           example: medical-ecommerce/home-videos/thumb
 *         productId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         sortOrder:
 *           type: integer
 *           example: 0
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         product:
 *           nullable: true
 *           $ref: '#/components/schemas/VideoProduct'
 */

// ─── Public Routes ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /videos:
 *   get:
 *     tags: [Videos]
 *     summary: Get active home page videos
 *     description: Home page ke liye active videos fetch karo (sorted by sortOrder). No auth required.
 *     responses:
 *       200:
 *         description: List of active videos with linked product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Fetched successfully.
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HomeVideo'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', videoController.getActiveVideos);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// NOTE: These must be registered before POST /:videoId/add-to-cart to prevent
// 'admin' and 'reorder' being captured as the :videoId param.

/**
 * @swagger
 * /videos/admin:
 *   get:
 *     tags: [Videos]
 *     summary: Get all videos (Admin)
 *     description: Admin panel ke liye sab videos fetch karo — active aur inactive dono.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All videos list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Fetched successfully.
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HomeVideo'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/admin', authenticate, isAdmin, videoController.getAllVideosAdmin);

/**
 * @swagger
 * /videos/admin/{id}:
 *   get:
 *     tags: [Videos]
 *     summary: Get single video by ID (Admin)
 *     description: Single video ka full detail fetch karo by UUID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: HomeVideo UUID
 *         example: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *     responses:
 *       200:
 *         description: Video detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Fetched successfully.
 *                 data:
 *                   $ref: '#/components/schemas/HomeVideo'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Video not found
 */
router.get('/admin/:id', authenticate, isAdmin, videoController.getVideoById);

/**
 * @swagger
 * /videos/reorder:
 *   patch:
 *     tags: [Videos]
 *     summary: Reorder videos (Admin)
 *     description: Multiple videos ka sortOrder ek saath update karo. Frontend drag-and-drop ke baad call karo.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 description: Array of { id, sortOrder } pairs
 *                 items:
 *                   type: object
 *                   required: [id, sortOrder]
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *                     sortOrder:
 *                       type: integer
 *                       example: 1
 *           example:
 *             items:
 *               - id: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *                 sortOrder: 0
 *               - id: 3f2504e0-4f89-11d3-9a0c-0305e82c3301
 *                 sortOrder: 1
 *     responses:
 *       200:
 *         description: Videos reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Updated successfully.
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HomeVideo'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: items array is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/reorder', authenticate, isAdmin, videoController.reorderVideos);

// ─── Authenticated User Routes ────────────────────────────────────────────────

/**
 * @swagger
 * /videos/{videoId}/add-to-cart:
 *   post:
 *     tags: [Videos]
 *     summary: Add video's linked product to cart
 *     description: |
 *       Home page video section se directly product ko cart mein add karo.
 *       Video ke saath linked productId automatically use hota hai — frontend ko productId bhejne ki zaroorat nahi.
 *       Agar video mein product linked nahi hai toh 400 error milega.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: HomeVideo UUID
 *         example: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variantId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional — agar product ka specific variant add karna ho
 *                 example: null
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 1
 *                 example: 1
 *     responses:
 *       200:
 *         description: Item added — returns updated cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Item added to cart.
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Video has no linked product / insufficient stock / invalid quantity
 *       401:
 *         description: Unauthorized — token missing or invalid
 *       404:
 *         description: Video not found / Product not found
 */
router.post(
  '/:videoId/add-to-cart',
  authenticate,
  validate(addToCartFromVideo),
  videoController.addVideoProductToCart
);

/**
 * @swagger
 * /videos:
 *   post:
 *     tags: [Videos]
 *     summary: Create new home video (Admin)
 *     description: |
 *       Naya home page video create karo. multipart/form-data use karo.
 *       - `video` field required (mp4/webm/mov/avi, max 100MB)
 *       - `thumbnail` field optional (jpg/png/webp, max 5MB)
 *       - `productId` optional — agar video kisi product se link karna ho
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, video]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 300
 *                 example: Best Selling Paracetamol
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (mp4/webm/mov/avi) — max 100MB
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Thumbnail image (jpg/png/webp) — max 5MB — optional
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: Linked product UUID — optional
 *                 example: 550e8400-e29b-41d4-a716-446655440000
 *               sortOrder:
 *                 type: integer
 *                 default: 0
 *                 example: 0
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Video created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Video created successfully.
 *                 data:
 *                   $ref: '#/components/schemas/HomeVideo'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Title or video file missing / invalid file type
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  videoFields,
  videoController.createVideo
);

/**
 * @swagger
 * /videos/{id}:
 *   put:
 *     tags: [Videos]
 *     summary: Update home video (Admin)
 *     description: |
 *       Existing video update karo. multipart/form-data use karo.
 *       Sirf woh fields bhejo jo update karni hain — partial update supported.
 *       Naya video/thumbnail upload karne par purana Cloudinary se delete ho jaata hai.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: HomeVideo UUID
 *         example: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 300
 *                 example: Updated Title
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: New video file — optional
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: New thumbnail — optional
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Link to a product or null to unlink
 *               sortOrder:
 *                 type: integer
 *                 example: 2
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Video updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Video updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/HomeVideo'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Video not found
 */
router.put(
  '/:id',
  authenticate,
  isAdmin,
  videoFields,
  videoController.updateVideo
);

/**
 * @swagger
 * /videos/{id}:
 *   delete:
 *     tags: [Videos]
 *     summary: Delete home video (Admin)
 *     description: Video delete karo. Video aur thumbnail dono Cloudinary se bhi remove ho jaate hain.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: HomeVideo UUID
 *         example: 7c9e6679-7425-40de-944b-e07fc1f90ae7
 *     responses:
 *       200:
 *         description: Video deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Video deleted successfully.
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Video not found
 */
router.delete('/:id', authenticate, isAdmin, videoController.deleteVideo);

module.exports = router;
