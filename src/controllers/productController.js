'use strict';

const productService = require('../services/productService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, HTTP_STATUS } = require('../constants');

const listProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await productService.listProducts(req.query);
  sendPaginated(res, MESSAGES.FETCHED, products, meta);
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);
  sendSuccess(res, MESSAGES.FETCHED, product);
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  sendSuccess(res, MESSAGES.FETCHED, product);
});

const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 8), 50);
  const products = await productService.getFeaturedProducts(limit);
  sendSuccess(res, MESSAGES.FETCHED, products);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.files);
  sendSuccess(res, MESSAGES.CREATED, product, HTTP_STATUS.CREATED);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body, req.files);
  sendSuccess(res, MESSAGES.UPDATED, product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(req.params.id);
  sendSuccess(res, result.message);
});

const deleteProductImage = asyncHandler(async (req, res) => {
  await productService.deleteProductImage(req.params.id, req.body.publicId);
  sendSuccess(res, 'Image deleted.');
});

module.exports = { listProducts, getProduct, getProductById, getFeaturedProducts, createProduct, updateProduct, deleteProduct, deleteProductImage };
