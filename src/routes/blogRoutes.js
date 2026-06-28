'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/blogController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { cache } = require('../middleware/cache');
const { blogUpload, handleMulterError } = require('../middleware/upload');
const { CACHE_TTL, ROLES } = require('../constants');
const v = require('../validations/blogValidation');

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /blogs:
 *   get:
 *     tags: [Blogs]
 *     summary: List published blogs
 *     description: Returns a paginated list of published blog posts. Supports filter by category, tags, and featured status.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by blog category
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *         description: Comma-separated tags to filter by
 *       - in: query
 *         name: isFeatured
 *         schema: { type: string, enum: ['true','false'] }
 *         description: Filter featured blog posts only
 *     responses:
 *       200:
 *         description: Paginated list of published blogs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/', cache(CACHE_TTL.BLOG_LIST), validate(v.blogQuery, 'query'), ctrl.listBlogs);

/**
 * @swagger
 * /blogs/search:
 *   get:
 *     tags: [Blogs]
 *     summary: Full-text search across published blogs
 *     description: Searches blog titles, content and tags for the given query string.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query string
 *         example: medicine
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Blog search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/search', validate(v.blogQuery, 'query'), ctrl.searchBlogs);

/**
 * @swagger
 * /blogs/featured:
 *   get:
 *     tags: [Blogs]
 *     summary: Get featured blog posts
 *     description: Returns the top N featured and published blog posts.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6, minimum: 1, maximum: 50 }
 *         description: Number of featured blogs to return
 *     responses:
 *       200:
 *         description: List of featured blogs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { type: array, items: { type: object } }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/featured', cache(CACHE_TTL.BLOG_LIST), ctrl.getFeaturedBlogs);

/**
 * @swagger
 * /blogs/{id}/like:
 *   post:
 *     tags: [Blogs]
 *     summary: Like a blog post
 *     description: Increments the like count for a published blog post.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Like count incremented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Liked. }
 *                 data:
 *                   type: object
 *                   properties:
 *                     likes: { type: integer, example: 42 }
 *                 timestamp: { type: string, format: date-time }
 *       404: { description: Blog not found }
 */
router.post('/:id/like', ctrl.likeBlog);

/**
 * @swagger
 * /blogs/{slug}:
 *   get:
 *     tags: [Blogs]
 *     summary: Get a published blog by slug
 *     description: Returns full blog post detail by slug. Response is cached.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: Blog post URL slug
 *         example: top-10-medicines-for-fever
 *     responses:
 *       200:
 *         description: Blog post detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       404:
 *         description: Blog post not found
 */
router.get('/:slug', cache(CACHE_TTL.BLOG_DETAIL), ctrl.getBlog);

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /blogs/admin/all:
 *   get:
 *     tags: [Blogs]
 *     summary: List all blogs including drafts (Admin)
 *     description: Returns all blog posts regardless of status. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, archived] }
 *         description: Filter by blog status
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of all blogs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.get('/admin/all', authenticate, authorize(ROLES.ADMIN), validate(v.blogQuery, 'query'), ctrl.listAllAdmin);

/**
 * @swagger
 * /blogs/admin/{id}:
 *   get:
 *     tags: [Blogs]
 *     summary: Get any blog by ID (Admin)
 *     description: Returns full blog post detail by ID regardless of status. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Blog post detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Blog post not found }
 */
router.get('/admin/:id', authenticate, authorize(ROLES.ADMIN), ctrl.getBlogAdmin);

/**
 * @swagger
 * /blogs:
 *   post:
 *     tags: [Blogs]
 *     summary: Create a blog post (Admin)
 *     description: Creates a new blog post with optional cover image upload.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string, minLength: 3, maxLength: 300, example: Top 10 Medicines for Fever }
 *               content: { type: string, minLength: 10, example: Detailed blog content here... }
 *               excerpt: { type: string, maxLength: 500, example: A quick summary of the post }
 *               category: { type: string, example: Health Tips }
 *               tags: { type: string, description: 'Comma-separated or JSON array e.g. fever,medicine' }
 *               status: { type: string, enum: [draft, published, archived], default: draft }
 *               isFeatured: { type: boolean, default: false }
 *               metaTitle: { type: string, maxLength: 200 }
 *               metaDescription: { type: string, maxLength: 500 }
 *               coverImage: { type: string, format: binary, description: Cover image (jpeg/png/webp) }
 *     responses:
 *       201:
 *         description: Blog post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Blog created. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), blogUpload.single('coverImage'), handleMulterError, validate(v.createBlog), ctrl.createBlog);

/**
 * @swagger
 * /blogs/{id}:
 *   put:
 *     tags: [Blogs]
 *     summary: Update a blog post (Admin)
 *     description: Updates an existing blog post. Replaces cover image if a new one is uploaded.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, minLength: 3, maxLength: 300 }
 *               content: { type: string, minLength: 10 }
 *               excerpt: { type: string, maxLength: 500 }
 *               category: { type: string }
 *               status: { type: string, enum: [draft, published, archived] }
 *               isFeatured: { type: boolean }
 *               metaTitle: { type: string }
 *               metaDescription: { type: string }
 *               coverImage: { type: string, format: binary, description: New cover image to replace existing }
 *     responses:
 *       200:
 *         description: Blog post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Blog updated. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Blog post not found }
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), blogUpload.single('coverImage'), handleMulterError, validate(v.updateBlog), ctrl.updateBlog);

/**
 * @swagger
 * /blogs/{id}:
 *   delete:
 *     tags: [Blogs]
 *     summary: Delete a blog post (Admin)
 *     description: Permanently deletes a blog post and its cover image from Cloudinary.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Blog post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Blog deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Blog post not found }
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), ctrl.deleteBlog);

/**
 * @swagger
 * /blogs/{id}/publish:
 *   patch:
 *     tags: [Blogs]
 *     summary: Publish a blog post (Admin)
 *     description: Changes blog status to `published`. Fails if already published.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Blog post published successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Blog published. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Blog post not found }
 *       409: { description: Blog post is already published }
 */
router.patch('/:id/publish', authenticate, authorize(ROLES.ADMIN), ctrl.publishBlog);

/**
 * @swagger
 * /blogs/{id}/unpublish:
 *   patch:
 *     tags: [Blogs]
 *     summary: Unpublish a blog post (Admin)
 *     description: Changes blog status back to `draft`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Blog post unpublished successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Blog unpublished. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Blog post not found }
 */
router.patch('/:id/unpublish', authenticate, authorize(ROLES.ADMIN), ctrl.unpublishBlog);

module.exports = router;
