'use strict';

const analytics = require('../services/analyticsService');
const prisma = require('../repositories/prismaClient');

// Map endpoint patterns to readable action names
const ACTION_MAP = [
  { method: 'POST',   pattern: /\/auth\/register$/,         action: 'register' },
  { method: 'POST',   pattern: /\/auth\/login$/,             action: 'login' },
  { method: 'POST',   pattern: /\/auth\/google$/,            action: 'google_login' },
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

// Skip analytics paths to avoid infinite loops or noise — tested against originalUrl so /api/v1 prefix works
const SKIP = /\/(analytics|health|docs|swagger|uploads)\b/;

// Auth sub-paths that are noise — tested against originalUrl so /api/v1 prefix also works
const SKIP_AUTH = /\/auth\/(refresh-token|send-otp|verify-otp)(\?.*)?$/

const analyticsMiddleware = (req, res, next) => {
  if (SKIP.test(req.originalUrl) || SKIP_AUTH.test(req.originalUrl)) return next();

  const url = req.originalUrl;
  const method = req.method;
  const action = resolveAction(method, url);

  res.on('finish', () => {
    if (res.statusCode === 404) return;

    // req.analyticsUserId is set by login()/googleAuth() before response is sent
    const userId = req.user?.id || req.analyticsUserId || null;

    analytics.track(() => analytics.trackActivity(
      { ...req, originalUrl: url, method, user: userId ? { id: userId } : req.user },
      res,
      action
    ));

    // req.analyticsSessionId is set by login()/googleAuth() (awaited) before res.json() fires
    // For all other routes it comes from auth middleware via req.user session lookup
    const sid = req.analyticsSessionId || res.locals.analyticsSessionId || null;
    if (sid) {
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
