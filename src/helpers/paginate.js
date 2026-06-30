'use strict';

const { PAGINATION } = require('../constants');

/**
 * Parse and sanitize pagination query parameters
 * @param {object} query - req.query object
 * @returns {{ page, limit, skip }}
 */
const parsePagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    Math.max(1, parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT),
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build pagination metadata object
 * @param {number} total - Total documents in DB
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object} Pagination metadata
 */
const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Build a MongoDB sort object from query string
 * e.g. sort=-price,createdAt → { price: -1, createdAt: 1 }
 * @param {string} sortString - Comma-separated sort fields
 * @param {string} defaultSort - Default sort if none provided
 * @returns {object}
 */
const buildSort = (sortString, defaultSort = '-createdAt') => {
  const sortStr = sortString || defaultSort;
  const sortObj = {};

  sortStr.split(',').forEach((field) => {
    const trimmed = field.trim();
    if (trimmed.startsWith('-')) {
      sortObj[trimmed.slice(1)] = -1;
    } else {
      sortObj[trimmed] = 1;
    }
  });

  return sortObj;
};

module.exports = { parsePagination, buildPaginationMeta, buildSort };
