'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../constants');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get('/summary',              ctrl.getSummary);
router.get('/graph/logins',         ctrl.getLoginGraph);          // ?period=daily|weekly|monthly
router.get('/graph/registrations',  ctrl.getRegistrationTrend);   // ?days=30
router.get('/most-active-users',    ctrl.getMostActiveUsers);
router.get('/recent-activities',    ctrl.getRecentActivities);
router.get('/login-history',        ctrl.getLoginHistory);
router.get('/registration-history', ctrl.getRegistrationHistory);
router.get('/activity-history',     ctrl.getActivityHistory);
router.get('/session-history',      ctrl.getSessionHistory);
router.get('/export',               ctrl.exportHistory);          // ?type=login|registration|session|activity&format=csv

module.exports = router;
