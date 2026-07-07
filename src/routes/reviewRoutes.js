'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { generalLimiter } = require('../middleware/rateLimiter');
const Joi = require('joi');

const createReview = Joi.object({
  productId: Joi.string().uuid().required(),
  orderId: Joi.string().uuid().optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().max(200).optional(),
  comment: Joi.string().trim().min(5).max(2000).required(),
});

const updateReview = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  title: Joi.string().trim().max(200).optional(),
  comment: Joi.string().trim().min(5).max(2000).optional(),
});

const reviewQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('-createdAt', '-helpfulVotes', 'rating', '-rating').optional(),
});
/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         orderId: { type: string, format: uuid, nullable: true }
 *         rating: { type: integer, minimum: 1, maximum: 5, example: 4 }
 *         title: { type: string, nullable: true, example: Great product }
 *         comment: { type: string, example: Works exactly as described. Very effective. }
 *         isVerifiedPurchase: { type: boolean, example: true }
 *         isApproved: { type: boolean, example: true }
 *         helpfulVotes: { type: integer, example: 12 }
 *         replyMessage: { type: string, nullable: true }
 *         replyRepliedAt: { type: string, format: date-time, nullable: true }
 *         user:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             firstName: { type: string, example: Saumya }
 *             lastName: { type: string, example: Singh }
 *             avatarUrl: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /reviews/product/{productId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get reviews for a product
 *     description: Returns paginated approved reviews for a product, sorted by newest first.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [-createdAt, -helpfulVotes, rating, -rating], default: -createdAt }
 *     responses:
 *       200:
 *         description: Paginated reviews with rating summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Review' }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 128 }
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 20 }
 *                         totalPages: { type: integer, example: 7 }
 *                     averageRating: { type: number, example: 4.5 }
 *                     ratingCount: { type: integer, example: 128 }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/product/:productId', validate(reviewQuery, 'query'), ctrl.getProductReviews);

/**
 * @swagger
 * /reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Create a product review
 *     description: Submits a review for a product. A user can only review each product once.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, rating, comment]
 *             properties:
 *               productId: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *               orderId: { type: string, format: uuid, description: Order UUID to mark as verified purchase }
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               title: { type: string, maxLength: 200, example: Great product! }
 *               comment: { type: string, minLength: 5, maxLength: 2000, example: Works exactly as described. }
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Review submitted. }
 *                 data: { $ref: '#/components/schemas/Review' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Product not found }
 *       409: { description: You have already reviewed this product }
 */
router.post('/', authenticate, validate(createReview), ctrl.createReview);

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     tags: [Reviews]
 *     summary: Update your review
 *     description: Updates an existing review. Users can only update their own reviews.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Review UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 4 }
 *               title: { type: string, maxLength: 200, example: Good product }
 *               comment: { type: string, minLength: 5, maxLength: 2000, example: Updated review comment. }
 *     responses:
 *       200:
 *         description: Review updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Review updated. }
 *                 data: { $ref: '#/components/schemas/Review' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Cannot edit another user's review }
 *       404: { description: Review not found }
 */
router.put('/:id', authenticate, validate(updateReview), ctrl.updateReview);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     tags: [Reviews]
 *     summary: Delete your review
 *     description: Deletes a review. Users can only delete their own reviews. Admins can delete any review.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Review deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Cannot delete another user's review }
 *       404: { description: Review not found }
 */
router.delete('/:id', authenticate, ctrl.deleteReview);

/**
 * @swagger
 * /reviews/{id}/vote:
 *   post:
 *     tags: [Reviews]
 *     summary: Vote a review as helpful
 *     description: Marks a review as helpful. Each user can vote once per review. Voting again removes the vote.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vote toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Voted as helpful. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     helpfulVotes: { type: integer, example: 13 }
 *                     action: { type: string, enum: [added, removed], example: added }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       404: { description: Review not found }
 */
router.post('/:id/vote', authenticate, ctrl.voteHelpful);

module.exports = router;
