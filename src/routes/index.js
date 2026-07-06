'use strict';

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const paymentRoutes = require('./paymentRoutes');
const reviewRoutes = require('./reviewRoutes');
const couponRoutes = require('./couponRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');
const blogRoutes = require('./blogRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const videoRoutes = require('./videoRoutes');
const contactRoutes = require('./contactRoutes');
const searchRoutes = require('./searchRoutes');
const leadRoutes   = require('./leadRoutes');
const interaktRoutes = require('./interaktRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/coupons', couponRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/blogs', blogRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/videos', videoRoutes);
router.use('/contact', contactRoutes);
router.use('/search', searchRoutes);
router.use('/leads', leadRoutes);
router.use('/interakt', interaktRoutes);

module.exports = router;
