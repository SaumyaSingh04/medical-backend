'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/searchController');
const { cache }      = require('../middleware/cache');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/authorize');
const { ROLES }        = require('../constants');

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Universal search across products, categories & blogs
 *     description: Full-text search across products, categories, and published blogs. Results are cached for 60 seconds.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query string
 *         example: paracetamol
 *     responses:
 *       200:
 *         description: Search results grouped by type
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
 *                     products: { type: array, items: { $ref: '#/components/schemas/Product' } }
 *                     categories: { type: array, items: { $ref: '#/components/schemas/Category' } }
 *                     blogs: { type: array, items: { type: object } }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/', cache(60), ctrl.universalSearch);

/**
 * @swagger
 * /search/suggestions:
 *   get:
 *     tags: [Search]
 *     summary: Autocomplete suggestions
 *     description: Fast autocomplete returning product names and category names matching the query. Cached for 60 seconds.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Partial search string
 *         example: para
 *     responses:
 *       200:
 *         description: Autocomplete suggestions
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
 *                       label: { type: string, example: Paracetamol 500mg }
 *                       type: { type: string, enum: [product, category], example: product }
 *                       slug: { type: string, example: paracetamol-500mg }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/suggestions', cache(60), ctrl.getSuggestions);

/**
 * @swagger
 * /search/admin:
 *   get:
 *     tags: [Search]
 *     summary: Admin global search
 *     description: Searches across users, orders, leads, products, categories, and blogs. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query string
 *         example: john
 *     responses:
 *       200:
 *         description: Admin search results grouped by entity type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users: { type: array, items: { type: object } }
 *                     orders: { type: array, items: { type: object } }
 *                     leads: { type: array, items: { type: object } }
 *                     products: { type: array, items: { type: object } }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/admin', authenticate, authorize(ROLES.ADMIN), ctrl.adminGlobalSearch);

module.exports = router;
