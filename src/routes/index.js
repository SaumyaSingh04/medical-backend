'use strict';

const express = require('express');
const router = express.Router();

const routes = [
  ['/auth',          './authRoutes'],
  ['/users',         './userRoutes'],
  ['/products',      './productRoutes'],
  ['/categories',    './categoryRoutes'],
  ['/cart',          './cartRoutes'],
  ['/orders',        './orderRoutes'],
  ['/payments',      './paymentRoutes'],
  ['/reviews',       './reviewRoutes'],
  ['/coupons',       './couponRoutes'],
  ['/admin',         './adminRoutes'],
  ['/notifications', './notificationRoutes'],
  ['/blogs',         './blogRoutes'],
  ['/analytics',     './analyticsRoutes'],
  ['/videos',        './videoRoutes'],
  ['/contact',       './contactRoutes'],
  ['/search',        './searchRoutes'],
  ['/leads',         './leadRoutes'],
  ['/interakt',      './interaktRoutes'],
];

for (const [path, file] of routes) {
  router.use(path, require(file));
}

module.exports = router;
