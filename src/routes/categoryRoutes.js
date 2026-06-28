'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { cache } = require('../middleware/cache');
const { categoryUpload, handleMulterError } = require('../middleware/upload');
const { CACHE_TTL, ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *         name: { type: string, example: Medicines }
 *         slug: { type: string, example: medicines }
 *         description: { type: string, nullable: true, example: All types of medicines }
 *         imageUrl: { type: string, nullable: true, example: 'https://res.cloudinary.com/demo/image/upload/category.jpg' }
 *         parentId: { type: string, nullable: true, format: uuid }
 *         ancestors: { type: array, items: { type: string, format: uuid } }
 *         level: { type: integer, example: 0 }
 *         isActive: { type: boolean, example: true }
 *         sortOrder: { type: integer, example: 0 }
 *         metaTitle: { type: string, nullable: true }
 *         metaDescription: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     CategoryTree:
 *       allOf:
 *         - $ref: '#/components/schemas/Category'
 *         - type: object
 *           properties:
 *             children:
 *               type: array
 *               items: { $ref: '#/components/schemas/CategoryTree' }
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Get all active categories
 *     description: Returns a flat list of all active categories. Response is cached.
 *     security: []
 *     responses:
 *       200:
 *         description: List of active categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Category' }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/', cache(CACHE_TTL.CATEGORY_LIST), ctrl.getAllCategories);

/**
 * @swagger
 * /categories/tree:
 *   get:
 *     tags: [Categories]
 *     summary: Get category hierarchy tree
 *     description: Returns categories as a nested tree. Top-level categories include their children recursively.
 *     security: []
 *     responses:
 *       200:
 *         description: Nested category tree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CategoryTree' }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/tree', cache(CACHE_TTL.CATEGORY_LIST), ctrl.getCategoryTree);

/**
 * @swagger
 * /categories/{slug}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by slug
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: medicines
 *     responses:
 *       200:
 *         description: Category detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully. }
 *                 data: { $ref: '#/components/schemas/Category' }
 *                 timestamp: { type: string, format: date-time }
 *       404: { description: Category not found }
 */
router.get('/:slug', ctrl.getCategoryBySlug);

/**
 * @swagger
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a category (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100, example: Pain Relief }
 *               description: { type: string, maxLength: 500, example: Products for pain relief }
 *               parentId: { type: string, format: uuid, description: Parent category UUID for subcategories }
 *               sortOrder: { type: integer, default: 0 }
 *               metaTitle: { type: string }
 *               metaDescription: { type: string }
 *               image: { type: string, format: binary, description: Category image (jpeg/png/webp) }
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Category created. }
 *                 data: { $ref: '#/components/schemas/Category' }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       409: { description: Category with this name or slug already exists }
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), categoryUpload.single('image'), handleMulterError, ctrl.createCategory);

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     tags: [Categories]
 *     summary: Update a category (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Category UUID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100 }
 *               description: { type: string, maxLength: 500 }
 *               isActive: { type: boolean }
 *               sortOrder: { type: integer }
 *               metaTitle: { type: string }
 *               metaDescription: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Category updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Category updated. }
 *                 data: { $ref: '#/components/schemas/Category' }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Category not found }
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), categoryUpload.single('image'), handleMulterError, ctrl.updateCategory);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a category (Admin)
 *     description: Deletes the category and its image from Cloudinary. Fails if products are assigned.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Category UUID
 *     responses:
 *       200:
 *         description: Category deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Category deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — Admin only }
 *       404: { description: Category not found }
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), ctrl.deleteCategory);

module.exports = router;
