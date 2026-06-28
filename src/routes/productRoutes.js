'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { cache } = require('../middleware/cache');
const { productUpload, handleMulterError } = require('../middleware/upload');
const { CACHE_TTL, ROLES } = require('../constants');
const v = require('../validations/productValidation');

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductImage:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *         publicId:
 *           type: string
 *           example: products/sample
 *
 *     ProductVariant:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: 500mg
 *         sku:
 *           type: string
 *           example: MED-001-500
 *         price:
 *           type: number
 *           example: 149.99
 *         stock:
 *           type: integer
 *           example: 50
 *         attributes:
 *           type: object
 *           example: { strength: "500mg", form: "tablet" }
 *
 *     Product:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: uuid
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         name:
 *           type: string
 *           example: Paracetamol 500mg
 *         slug:
 *           type: string
 *           example: paracetamol-500mg
 *         description:
 *           type: string
 *           example: Effective pain relief and fever reducer.
 *         shortDescription:
 *           type: string
 *           example: Fast-acting paracetamol tablets.
 *         brand:
 *           type: string
 *           example: Cipla
 *         price:
 *           type: number
 *           example: 49.99
 *         compareAtPrice:
 *           type: number
 *           example: 69.99
 *         stock:
 *           type: integer
 *           example: 200
 *         sku:
 *           type: string
 *           example: MED-PCT-001
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["paracetamol", "fever", "pain-relief"]
 *         isFeatured:
 *           type: boolean
 *           example: true
 *         isActive:
 *           type: boolean
 *           example: true
 *         averageRating:
 *           type: number
 *           example: 4.5
 *         ratingCount:
 *           type: integer
 *           example: 128
 *         totalSold:
 *           type: integer
 *           example: 540
 *         thumbnail:
 *           $ref: '#/components/schemas/ProductImage'
 *         images:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductImage'
 *         category:
 *           type: object
 *           properties:
 *             _id: { type: string, format: uuid }
 *             name: { type: string, example: Medicines }
 *             slug: { type: string, example: medicines }
 *         subcategory:
 *           type: object
 *           properties:
 *             _id: { type: string, format: uuid }
 *             name: { type: string, example: Pain Relief }
 *             slug: { type: string, example: pain-relief }
 *         variants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductVariant'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 240
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             totalPages:
 *               type: integer
 *               example: 12
 *             hasNextPage:
 *               type: boolean
 *               example: true
 *             hasPrevPage:
 *               type: boolean
 *               example: false
 *
 *     ProductListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Fetched successfully.
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Product'
 *         meta:
 *           $ref: '#/components/schemas/PaginationMeta'
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     ProductDetailResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Fetched successfully.
 *         data:
 *           $ref: '#/components/schemas/Product'
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Resource not found.
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     ValidationErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Validation failed.
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field: { type: string, example: minPrice }
 *               message: { type: string, example: must be a number }
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: List products with search, filter & pagination
 *     description: |
 *       Returns a paginated list of active products.
 *       Supports full-text search, multiple filters, sorting and pagination.
 *
 *       **Search (`q`)** — searches across `name`, `description`, and `brand` (case-insensitive).
 *
 *       **Sorting** — prefix field with `-` for descending order (e.g. `-price`).
 *
 *       **Tags** — pass comma-separated values e.g. `organic,herbal`.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Full-text search across name, description and brand
 *         example: paracetamol
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of results per page (max 100)
 *         example: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [-createdAt, createdAt, price, -price, -averageRating, -totalSold]
 *           default: -createdAt
 *         description: |
 *           Sort order. Prefix with `-` for descending.
 *           - `-createdAt` — Newest first (default)
 *           - `price` — Price low to high
 *           - `-price` — Price high to low
 *           - `-averageRating` — Top rated
 *           - `-totalSold` — Best sellers
 *         example: -createdAt
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *       - in: query
 *         name: subcategory
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by subcategory UUID
 *         example: 660e8400-e29b-41d4-a716-446655440111
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filter by brand name (case-insensitive, partial match)
 *         example: Cipla
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum price filter
 *         example: 50
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum price filter
 *         example: 500
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum average rating filter
 *         example: 4
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter only in-stock products (stock > 0)
 *         example: "true"
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter featured products only
 *         example: "true"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *           default: "true"
 *         description: Filter by active status (default true — only active products)
 *         example: "true"
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags to filter by (matches any)
 *         example: organic,herbal
 *     responses:
 *       200:
 *         description: Paginated list of products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListResponse'
 *             example:
 *               success: true
 *               message: Fetched successfully.
 *               data:
 *                 - _id: 550e8400-e29b-41d4-a716-446655440000
 *                   name: Paracetamol 500mg
 *                   slug: paracetamol-500mg
 *                   price: 49.99
 *                   compareAtPrice: 69.99
 *                   brand: Cipla
 *                   stock: 200
 *                   isFeatured: true
 *                   isActive: true
 *                   averageRating: 4.5
 *                   ratingCount: 128
 *                   totalSold: 540
 *                   tags: ["paracetamol", "fever"]
 *                   thumbnail:
 *                     url: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *                     publicId: products/sample
 *                   category:
 *                     _id: 660e8400-e29b-41d4-a716-446655440111
 *                     name: Medicines
 *                     slug: medicines
 *               meta:
 *                 pagination:
 *                   total: 240
 *                   page: 1
 *                   limit: 20
 *                   totalPages: 12
 *                   hasNextPage: true
 *                   hasPrevPage: false
 *               timestamp: 2024-01-01T00:00:00.000Z
 *       400:
 *         description: Validation error — invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             example:
 *               success: false
 *               message: Validation failed.
 *               errors:
 *                 - field: minPrice
 *                   message: must be a number
 *               timestamp: 2024-01-01T00:00:00.000Z
 */
router.get('/', cache(CACHE_TTL.PRODUCT_LIST), validate(v.productQuery, 'query'), ctrl.listProducts);

/**
 * @swagger
 * /products/featured:
 *   get:
 *     tags: [Products]
 *     summary: Get featured products
 *     description: Returns top featured products sorted by rating. Falls back to top-rated active products if no featured products exist.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 8
 *         description: Number of featured products to return
 *         example: 8
 *     responses:
 *       200:
 *         description: List of featured products
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
 *                     $ref: '#/components/schemas/Product'
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/featured', cache(CACHE_TTL.PRODUCT_LIST), ctrl.getFeaturedProducts);

/**
 * @swagger
 * /products/id/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by UUID (Admin / internal)
 *     description: Returns full product detail by UUID. Useful for admin edit screens.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Product detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductDetailResponse'
 *       401: { description: Unauthorized }
 *       404: { description: Product not found }
 */
router.get('/id/:id', authenticate, authorize(ROLES.ADMIN), ctrl.getProductById);

/**
 * @swagger
 * /products/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Get product detail by slug
 *     description: Returns full product detail by slug. Response is cached for 10 minutes.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Product URL slug
 *         example: paracetamol-500mg
 *     responses:
 *       200:
 *         description: Product detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductDetailResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Product not found.
 *               timestamp: 2024-01-01T00:00:00.000Z
 */
router.get('/:slug', cache(CACHE_TTL.PRODUCT_DETAIL), ctrl.getProduct);

/**
 * @swagger
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create a product (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, description, price, category]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 300
 *                 example: Paracetamol 500mg
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 example: Effective pain relief and fever reducer.
 *               shortDescription:
 *                 type: string
 *                 maxLength: 500
 *               brand:
 *                 type: string
 *                 example: Cipla
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 49.99
 *               compareAtPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 69.99
 *               costPrice:
 *                 type: number
 *                 minimum: 0
 *               category:
 *                 type: string
 *                 format: uuid
 *                 example: 550e8400-e29b-41d4-a716-446655440000
 *               subcategory:
 *                 type: string
 *                 format: uuid
 *               sku:
 *                 type: string
 *                 example: MED-PCT-001
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               isFeatured:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: string
 *                 description: JSON array string e.g. ["fever","pain"]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 10 product images
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductDetailResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), productUpload.array('images', 10), handleMulterError, validate(v.createProduct), ctrl.createProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update a product (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: Paracetamol 650mg }
 *               description: { type: string }
 *               brand: { type: string }
 *               price: { type: number, minimum: 0 }
 *               compareAtPrice: { type: number, minimum: 0 }
 *               stock: { type: integer, minimum: 0 }
 *               isActive: { type: boolean }
 *               isFeatured: { type: boolean }
 *               category: { type: string, format: uuid }
 *               subcategory: { type: string, format: uuid }
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New images to append (up to 10)
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductDetailResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), productUpload.array('images', 10), handleMulterError, validate(v.updateProduct), ctrl.updateProduct);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product (Admin only)
 *     description: Permanently deletes the product and all its Cloudinary images.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Deleted successfully. }
 *                 timestamp: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), ctrl.deleteProduct);

/**
 * @swagger
 * /products/{id}/images:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product image (Admin only)
 *     description: Removes an image from the product and deletes it from Cloudinary.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicId]
 *             properties:
 *               publicId:
 *                 type: string
 *                 description: Cloudinary public ID of the image to delete
 *                 example: products/sample
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Image deleted. }
 *                 timestamp: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id/images', authenticate, authorize(ROLES.ADMIN), ctrl.deleteProductImage);

module.exports = router;
