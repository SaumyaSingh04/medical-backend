'use strict';

const searchService = require('../services/searchService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../helpers/ApiError');

const requireQuery = (q) => {
  if (!q?.trim()) throw ApiError.badRequest('Search query is required.');
};

const universalSearch = asyncHandler(async (req, res) => {
  const { q, productLimit, categoryLimit, blogLimit } = req.query;
  requireQuery(q);
  const result = await searchService.universalSearch(q, {
    productLimit:  productLimit  ? Math.min(parseInt(productLimit,  10), 20) : 10,
    categoryLimit: categoryLimit ? Math.min(parseInt(categoryLimit, 10), 10) : 5,
    blogLimit:     blogLimit     ? Math.min(parseInt(blogLimit,     10), 10) : 5,
  });
  sendSuccess(res, 'Search results fetched.', result);
});

const getSuggestions = asyncHandler(async (req, res) => {
  requireQuery(req.query.q);
  sendSuccess(res, 'Suggestions fetched.', await searchService.getSuggestions(req.query.q));
});

const adminGlobalSearch = asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  const result = await searchService.adminGlobalSearch(q, {
    limit: limit ? Math.min(parseInt(limit, 10), 20) : 5,
  });
  sendSuccess(res, 'Search results fetched.', result);
});

module.exports = { universalSearch, getSuggestions, adminGlobalSearch };
