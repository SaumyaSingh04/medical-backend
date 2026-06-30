'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/searchController');
const { cache } = require('../middleware/cache');

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Universal search across products, categories and blogs
 */

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Universal search
 *     description: |
 *       Searches across **products**, **categories**, and **blogs** in a single request.
 *
 *       Results are grouped by type and returned together with per-type counts.
 *
 *       - Products are ranked by `totalSold` then `averageRating`
 *       - Categories are ranked by `sortOrder`
 *       - Blogs are ranked by `publishedAt` (newest first)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query string
 *         example: paracetamol
 *       - in: query
 *         name: productLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *         description: Max number of product results (default 10, max 20)
 *       - in: query
 *         name: categoryLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 5
 *         description: Max number of category results (default 5, max 10)
 *       - in: query
 *         name: blogLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 5
 *         description: Max number of blog results (default 5, max 10)
 *     responses:
 *       200:
 *         description: Grouped search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Search results fetched. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     query: { type: string, example: paracetamol }
 *                     results:
 *                       type: object
 *                       properties:
 *                         products:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string, example: Paracetamol 500mg }
 *                               slug: { type: string, example: paracetamol-500mg }
 *                               price: { type: number, example: 49.99 }
 *                               compareAtPrice: { type: number, nullable: true, example: 69.99 }
 *                               thumbnail:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url: { type: string, example: 'https://res.cloudinary.com/demo/image/upload/product.jpg' }
 *                               brand: { type: string, example: Cipla }
 *                               stock: { type: integer, example: 200 }
 *                               averageRating: { type: number, example: 4.5 }
 *                               ratingCount: { type: integer, example: 128 }
 *                               category:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   id: { type: string, format: uuid }
 *                                   name: { type: string, example: Medicines }
 *                                   slug: { type: string, example: medicines }
 *                         categories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string, example: Pain Relief }
 *                               slug: { type: string, example: pain-relief }
 *                               image:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url: { type: string }
 *                               level: { type: integer, example: 1 }
 *                               parentId: { type: string, nullable: true }
 *                         blogs:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               title: { type: string, example: Top 10 Uses of Paracetamol }
 *                               slug: { type: string, example: top-10-uses-of-paracetamol }
 *                               excerpt: { type: string, nullable: true }
 *                               coverImage:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   url: { type: string }
 *                               publishedAt: { type: string, format: date-time }
 *                               category: { type: string, example: Health Tips }
 *                               tags: { type: array, items: { type: string } }
 *                     counts:
 *                       type: object
 *                       properties:
 *                         products: { type: integer, example: 8 }
 *                         categories: { type: integer, example: 2 }
 *                         blogs: { type: integer, example: 3 }
 *                         total: { type: integer, example: 13 }
 *                 timestamp: { type: string, format: date-time }
 *             example:
 *               success: true
 *               message: Search results fetched.
 *               data:
 *                 query: paracetamol
 *                 results:
 *                   products:
 *                     - id: 550e8400-e29b-41d4-a716-446655440000
 *                       name: Paracetamol 500mg
 *                       slug: paracetamol-500mg
 *                       price: 49.99
 *                       compareAtPrice: 69.99
 *                       thumbnail: { url: 'https://res.cloudinary.com/demo/image/upload/product.jpg' }
 *                       brand: Cipla
 *                       stock: 200
 *                       averageRating: 4.5
 *                       ratingCount: 128
 *                       category: { id: abc, name: Medicines, slug: medicines }
 *                   categories:
 *                     - id: xyz
 *                       name: Pain Relief
 *                       slug: pain-relief
 *                       image: null
 *                       level: 1
 *                       parentId: parent-id
 *                   blogs:
 *                     - id: blog-uuid
 *                       title: Top 10 Uses of Paracetamol
 *                       slug: top-10-uses-of-paracetamol
 *                       excerpt: A quick guide to paracetamol usage
 *                       coverImage: null
 *                       publishedAt: '2024-06-01T00:00:00.000Z'
 *                       category: Health Tips
 *                       tags: [paracetamol, fever]
 *                 counts:
 *                   products: 1
 *                   categories: 1
 *                   blogs: 1
 *                   total: 3
 *               timestamp: '2024-06-01T10:00:00.000Z'
 *       400: { description: q param is missing or empty }
 */
router.get('/', cache(60), ctrl.universalSearch);

/**
 * @swagger
 * /search/suggestions:
 *   get:
 *     tags: [Search]
 *     summary: Autocomplete suggestions
 *     description: |
 *       Returns fast lightweight suggestions for **search-as-you-type** dropdowns.
 *
 *       Returns matching product names and category names combined in a single flat list.
 *       - Categories appear first
 *       - Products follow, with thumbnail and price
 *       - Minimum 2 characters required
 *       - Response is cached for 60 seconds
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search prefix (minimum 2 characters)
 *         example: para
 *     responses:
 *       200:
 *         description: Flat list of autocomplete suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Suggestions fetched. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     query: { type: string, example: para }
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [product, category]
 *                             example: product
 *                           id: { type: string, format: uuid }
 *                           label: { type: string, example: Paracetamol 500mg }
 *                           slug: { type: string, example: paracetamol-500mg }
 *                           thumbnail:
 *                             type: object
 *                             nullable: true
 *                             description: Only present for product type
 *                             properties:
 *                               url: { type: string }
 *                           price:
 *                             type: number
 *                             nullable: true
 *                             description: Only present for product type
 *                             example: 49.99
 *                 timestamp: { type: string, format: date-time }
 *             example:
 *               success: true
 *               message: Suggestions fetched.
 *               data:
 *                 query: para
 *                 suggestions:
 *                   - type: category
 *                     id: cat-uuid
 *                     label: Pain Relief
 *                     slug: pain-relief
 *                   - type: product
 *                     id: prod-uuid
 *                     label: Paracetamol 500mg
 *                     slug: paracetamol-500mg
 *                     thumbnail: { url: 'https://res.cloudinary.com/demo/image/upload/product.jpg' }
 *                     price: 49.99
 *               timestamp: '2024-06-01T10:00:00.000Z'
 *       400: { description: q is missing, empty, or less than 2 characters }
 */
router.get('/suggestions', cache(60), ctrl.getSuggestions);

module.exports = router;
