'use strict';

const categoryRepo    = require('./categoryRepo');
const blogRepo        = require('./blogRepo');
const userRepo        = require('./userRepo');
const productRepo     = require('./productRepo');
const orderRepo       = require('./orderRepo');
const cartRepo        = require('./cartRepo');
const paymentRepo     = require('./paymentRepo');
const reviewRepo      = require('./reviewRepo');
const couponRepo      = require('./couponRepo');
const notificationRepo = require('./notificationRepo');
const leadRepo         = require('./leadRepo');
const auditLogRepo     = require('./auditLogRepo');

module.exports = {
  categoryRepo,
  blogRepo,
  userRepo,
  productRepo,
  orderRepo,
  cartRepo,
  paymentRepo,
  reviewRepo,
  couponRepo,
  notificationRepo,
  leadRepo,
  auditLogRepo,
};
