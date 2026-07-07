'use strict';

const analytics = require('../services/analyticsService');
const prisma = require('../repositories/prismaClient');

// Pre-indexed by method — O(1) method lookup, then small per-method array scan
// instead of iterating the full ACTION_MAP on every request.
const ACTION_INDEX = new Map();

for (const entry of [
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
]) {
  if (!ACTION_INDEX.has(entry.method)) ACTION_INDEX.set(entry.method, []);
  ACTION_INDEX.get(entry.method).push(entry);
}

const METHOD_FALLBACK = {
  GET:    'view',
  POST:   'create',
  PUT:    'update',
  PATCH:  'update',
  DELETE: 'delete',
};

function resolveAction(method, url) {
  const entries = ACTION_INDEX.get(method);
  if (entries) {
    for (const e of entries) {
      if (e.pattern.test(url)) return e.action;
    }
  }
  return METHOD_FALLBACK[method] ?? 'api_access';
}

const SKIP      = /\/(analytics|health|docs|swagger|uploads)\b/;
const SKIP_AUTH = /\/auth\/(refresh-token|send-otp|verify-otp)(\?.*)?$/;

const SESSION_ACTIVITY_INTERVAL_MS = 60_000;
const THROTTLE_PRUNE_INTERVAL_MS   = 10 * 60_000;
const THROTTLE_MAX_AGE_MS          = 2 * SESSION_ACTIVITY_INTERVAL_MS;

const _sessionActivityThrottle = new Map();

const _pruneTimer = setInterval(() => {
  const cutoff = Date.now() - THROTTLE_MAX_AGE_MS;
  for (const [sid, ts] of _sessionActivityThrottle) {
    if (ts < cutoff) _sessionActivityThrottle.delete(sid);
  }
}, THROTTLE_PRUNE_INTERVAL_MS);
_pruneTimer.unref();

const analyticsMiddleware = (req, res, next) => {
  if (SKIP.test(req.originalUrl) || SKIP_AUTH.test(req.originalUrl)) return next();

  const { originalUrl: url, method } = req;
  const action = resolveAction(method, url);

  res.on('finish', () => {
    if (res.statusCode === 404) return;

    const userId = req.user?.id || req.analyticsUserId || null;
    analytics.track(() =>
      analytics.trackActivity(
        { ...req, originalUrl: url, method, user: userId ? { id: userId } : req.user },
        res,
        action,
      )
    );

    const sid = req.analyticsSessionId || res.locals.analyticsSessionId || null;
    if (sid) {
      const now  = Date.now();
      const last = _sessionActivityThrottle.get(sid) || 0;
      if (now - last >= SESSION_ACTIVITY_INTERVAL_MS) {
        _sessionActivityThrottle.set(sid, now);
        analytics.track(() =>
          prisma.userSession.updateMany({ where: { id: sid }, data: { lastActivityAt: new Date() } })
        );
      }
    }
  });

  next();
};

module.exports = { analyticsMiddleware };
