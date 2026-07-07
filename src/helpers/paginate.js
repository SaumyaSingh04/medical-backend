'use strict';

const { PAGINATION } = require('../constants');

const parsePagination = (query = {}) => {
  const page  = Math.max(1, parseInt(query.page,  10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT), PAGINATION.MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
};

const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
};

// e.g. "-price,createdAt" → { price: -1, createdAt: 1 }
const buildSort = (sortString, defaultSort = '-createdAt') =>
  (sortString || defaultSort).split(',').reduce((acc, field) => {
    const f = field.trim();
    acc[f.startsWith('-') ? f.slice(1) : f] = f.startsWith('-') ? -1 : 1;
    return acc;
  }, {});

module.exports = { parsePagination, buildPaginationMeta, buildSort };
