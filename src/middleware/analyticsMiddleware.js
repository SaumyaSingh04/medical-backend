'use strict';

const analytics = require('../services/analyticsService');
const prisma = require('../repositories/prismaClient');

// Map endpoint patterns to readable action names
const ACTION_MAP = [
  { method: 'POST',   pattern: /\/auth\/register$/,         action: 'register' },
  { method: 'POST',   pattern: /\/auth\/login$/,             action: 'login' },
  { method: 'POST',   pattern: /\/auth\/logout$/,            action: 'logout' },
  { method: 'GET',    pattern: /\/auth\/verify-email/,       action: 'email_verification' },
  { method: 'POST',   pattern: /\/auth\/forgot-password$/,   action: 'forgot_password' },
  { method: 'POST',   pattern: /\/auth\/reset-password$/,    action: 'password_reset' },
  { method: 'PUT',    pattern: /\/users\/profile$/,          action: 'profile_update' },
  { method: 'PATCH',  pattern: /\/users\/profile$/,          action: 'profile_update' },
  { method: 'PATCH',  pattern: /\/users\/password$/,         action: 'password_change' },
  { method: 'POST',   pattern: /\/orders/,                   action: 'order_create' },
  { method: 'PATCH',  pattern: /\/orders\/.+\/status/,       action: 'order_status_update' },
  { method: 'POST',   pattern: /\/payments/,                 action: 'payment_initiate' },
  { method: 'POST',   pattern: /\/cart/,                     action: 'cart_update' },
  { method: 'DELETE', pattern: /\/cart/,                     action: 'cart_update' },
  { method: 'POST',   pattern: /\/reviews/,                  action: 'review_create' },
  { method: 'PUT',    pattern: /\/reviews/,                  action: 'review_update' },
  { method: 'DELETE', pattern: /\/reviews/,                  action: 'review_delete' },
  { method: 'POST',   pattern: /\/products/,                 action: 'product_create' },
  { method: 'PUT',    pattern: /\/products/,                 action: 'product_update' },
  { method: 'PATCH',  pattern: /\/products/,                 action: 'product_update' },
  { method: 'DELETE', pattern: /\/products/,                 action: 'product_delete' },
  { method: 'POST',   pattern: /\/categories/,               action: 'category_create' },
  { method: 'PUT',    pattern: /\/categories/,               action: 'category_update' },
  { method: 'DELETE', pattern: /\/categories/,               action: 'category_delete' },
  { method: 'POST',   pattern: /\/blogs/,                    action: 'blog_create' },
  { method: 'PUT',    pattern: /\/blogs/,                    action: 'blog_update' },
  { method: 'PATCH',  pattern: /\/blogs/,                    action: 'blog_update' },
  { method: 'DELETE', pattern: /\/blogs/,                    action: 'blog_delete' },
  { method: 'POST',   pattern: /\/coupons/,                  action: 'coupon_create' },
  { method: 'POST',   pattern: /\/users\/wishlist/,          action: 'wishlist_update' },
  { method: 'POST',   pattern: /\/users\/addresses/,         action: 'address_add' },
  { method: 'PUT',    pattern: /\/users\/addresses/,         action: 'address_update' },
  { method: 'DELETE', pattern: /\/users\/addresses/,         action: 'address_delete' },
];

function resolveAction(method, url) {
  for (const entry of ACTION_MAP) {
    if (entry.method === method && entry.pattern.test(url)) return entry.action;
  }
  if (method === 'GET') return 'view';
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'api_access';
}

// Skip analytics paths to avoid infinite loops
const SKIP = /\/(analytics|health|docs|swagger|uploads)\b/;

const analyticsMiddleware = (req, res, next) => {
  if (SKIP.test(req.path)) return next();

  res.on('finish', () => {
    if (res.statusCode === 404) return;

    // Track failed login attempts separately
    if (res.statusCode === 401) {
      const failAction = resolveAction(req.method, req.originalUrl);
      if (failAction === 'login') {
        analytics.track(() => analytics.trackActivity(req, res, 'failed_login'));
      }
      return;
    }

    // Resolve user from request (login sets analyticsUserId before res.finish)
    const userId = req.user?.id || req.analyticsUserId || null;
    const action = resolveAction(req.method, req.originalUrl);

    analytics.track(() => analytics.trackActivity(
      { ...req, user: userId ? { id: userId } : req.user },
      res,
      action
    ));

    // Update session lastActivityAt
    const sid = req.analyticsSessionId;
    if (userId && sid) {
      analytics.track(() =>
        prisma.userSession.updateMany({
          where: { id: sid },
          data: { lastActivityAt: new Date() },
        })
      );
    }
  });

  next();
};

module.exports = { analyticsMiddleware };
