'use strict';

const Joi = require('joi');

const createBlog = Joi.object({
  title: Joi.string().trim().min(3).max(300).required(),
  content: Joi.string().min(10).required(),
  excerpt: Joi.string().max(500).optional(),
  category: Joi.string().trim().optional(),
  tags: Joi.array().items(Joi.string().lowercase().trim()).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
  isFeatured: Joi.boolean().default(false),
  metaTitle: Joi.string().max(60).optional(),
  metaDescription: Joi.string().max(160).optional(),
  metaKeywords: Joi.array().items(Joi.string()).optional(),
  coverImage: Joi.object({
    url: Joi.string().uri().optional(),
    publicId: Joi.string().optional(),
    alt: Joi.string().optional(),
  }).optional(),
});

const updateBlog = createBlog.fork(Object.keys(createBlog.describe().keys), (s) => s.optional());

const blogQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().optional(),
  category: Joi.string().optional(),
  tags: Joi.string().optional(),
  author: Joi.string().uuid().optional(),
  isFeatured: Joi.string().valid('true', 'false').optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

module.exports = { createBlog, updateBlog, blogQuery };
