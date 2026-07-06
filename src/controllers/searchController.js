'use strict';

const searchService  = require('../services/searchService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler   = require('../utils/asyncHandler');
const ApiError       = require('../helpers/ApiError');

/**
 * GET /search?q=paracetamol&productLimit=10&categoryLimit=5&blogLimit=5
 * Universal search across products, categories, blogs
 */
const universalSearch = asyncHandler(async (req, res) => {
  const { q, productLimit, categoryLimit, blogLimit } = req.query;
  if (!q?.trim()) throw ApiError.badRequest('Search query is required.');

  const result = await searchService.universalSearch(q, {
    productLimit:  productLimit  ? Math.min(parseInt(productLimit),  20) : 10,
    categoryLimit: categoryLimit ? Math.min(parseInt(categoryLimit), 10) : 5,
    blogLimit:     blogLimit     ? Math.min(parseInt(blogLimit),     10) : 5,
  });

  sendSuccess(res, 'Search results fetched.', result);
});

/**
 * GET /search/suggestions?q=para
 * Fast autocomplete — product names + category names only
 */
const getSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) throw ApiError.badRequest('Search query is required.');
  const result = await searchService.getSuggestions(q);
  sendSuccess(res, 'Suggestions fetched.', result);
});

/**
 * GET /search/admin?q=john&limit=5
 * Admin global search — users, orders, leads + products/categories/blogs.
 * Protected: admin/super_admin only (enforced in route).
 */
const adminGlobalSearch = asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  const result = await searchService.adminGlobalSearch(q, {
    limit: limit ? Math.min(parseInt(limit), 20) : 5,
  });
  sendSuccess(res, 'Search results fetched.', result);
});

module.exports = { universalSearch, getSuggestions, adminGlobalSearch };
