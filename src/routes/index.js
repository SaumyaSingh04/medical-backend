'use strict';

const express = require('express');
const router = express.Router();

router.use('/auth',          require('./authRoutes'));
router.use('/users',         require('./userRoutes'));
router.use('/products',      require('./productRoutes'));
router.use('/categories',    require('./categoryRoutes'));
router.use('/cart',          require('./cartRoutes'));
router.use('/orders',        require('./orderRoutes'));
router.use('/payments',      require('./paymentRoutes'));
router.use('/reviews',       require('./reviewRoutes'));
router.use('/coupons',       require('./couponRoutes'));
router.use('/admin',         require('./adminRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/blogs',         require('./blogRoutes'));
router.use('/analytics',     require('./analyticsRoutes'));
router.use('/videos',        require('./videoRoutes'));
router.use('/contact',       require('./contactRoutes'));
router.use('/search',        require('./searchRoutes'));
router.use('/leads',         require('./leadRoutes'));
router.use('/interakt',      require('./interaktRoutes'));

module.exports = router;
