'use strict';

const Joi = require('joi');
const { id, boolStr, pagination } = require('./common');

const createProduct = Joi.object({
  name:             Joi.string().trim().min(3).max(300).required(),
  description:      Joi.string().min(10).required(),
  shortDescription: Joi.string().max(500).optional(),
  brand:            Joi.string().optional(),
  price:            Joi.number().min(0).required(),
  compareAtPrice:   Joi.number().min(0).optional(),
  costPrice:        Joi.number().min(0).optional(),
  category:         id().required(),
  subcategory:      id().optional(),
  tags:             Joi.array().items(Joi.string().lowercase()).optional(),
  sku:              Joi.string().optional(),
  stock:            Joi.number().integer().min(0).default(0),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  averageRating:    Joi.number().min(0).max(5).default(0),
  ratingCount:      Joi.number().integer().min(0).default(0),
  isFeatured:       Joi.boolean().default(false),
  metaTitle:        Joi.string().max(60).optional(),
  metaDescription:  Joi.string().max(160).optional(),
  weight:           Joi.number().min(0).optional(),
  hasVariants:      Joi.boolean().default(false),
  variants:         Joi.array().items(Joi.object({
    name:       Joi.string().required(),
    sku:        Joi.string().required(),
    price:      Joi.number().min(0).required(),
    stock:      Joi.number().integer().min(0).default(0),
    attributes: Joi.object().optional(),
  })).optional(),
});

const updateProduct = createProduct.fork(Object.keys(createProduct.describe().keys), (s) => s.optional());

const productQuery = Joi.object({
  ...pagination,
  sort:        Joi.string().valid('-createdAt', 'price', '-price', '-averageRating', '-totalSold').optional(),
  category:    id().optional(),
  subcategory: id().optional(),
  minPrice:    Joi.number().min(0).optional(),
  maxPrice:    Joi.number().min(0).optional(),
  minRating:   Joi.number().min(0).max(5).optional(),
  inStock:     boolStr().optional(),
  isFeatured:  boolStr().optional(),
  isActive:    boolStr().optional(),
  brand:       Joi.string().optional(),
  tags:        Joi.string().optional(),
  q:           Joi.string().max(200).optional(),
});

const deleteImage = Joi.object({
  publicId: Joi.string().trim().min(1).max(500).required(),
});

module.exports = { createProduct, updateProduct, productQuery, deleteImage };
