'use strict';

// ─── HTTP Status Codes ────────────────────────────────────────────────────────
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ─── User Roles ───────────────────────────────────────────────────────────────
const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  // SUPER_ADMIN: 'super_admin',
};

// ─── CRM Lead Statuses ───────────────────────────────────────────────────────────
const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  FOLLOW_UP: 'follow_up',
  CNP: 'cnp',
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  CONVERTED: 'converted',
  LOST: 'lost',
};

const LEAD_SOURCE = {
  WEBSITE: 'website',
  WHATSAPP: 'whatsapp',
  SOCIAL_MEDIA: 'social_media',
  REFERRAL: 'referral',
  MANUAL: 'manual',
  CONTACT_FORM: 'contact_form',
  FRANCHISE_FORM: 'franchise_form',
  DISTRIBUTOR_FORM: 'distributor_form',
};

const FOLLOW_UP_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  MISSED: 'missed',
};

// ─── Order Statuses ───────────────────────────────────────────────────────────
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURN_REQUESTED: 'return_requested',
  RETURNED: 'returned',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

// ─── Payment Statuses ─────────────────────────────────────────────────────────
const PAYMENT_STATUS = {
  PENDING: 'pending',
  CREATED: 'created',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  CANCELLED: 'cancelled',
};

// ─── Payment Methods ──────────────────────────────────────────────────────────
const PAYMENT_METHOD = {
  RAZORPAY: 'razorpay',
  STRIPE: 'stripe',
  COD: 'cod',
  WALLET: 'wallet',
};

// ─── COD Settings ─────────────────────────────────────────────────────────────
const COD_SETTINGS = {
  CONFIRMATION_CHARGE: 100, // ₹100 COD confirmation charge
};

// ─── Notification Types ───────────────────────────────────────────────────────
const NOTIFICATION_TYPE = {
  ORDER_PLACED: 'order_placed',
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_RETURNED: 'order_returned',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_INITIATED: 'refund_initiated',
  REFUND_SUCCESS: 'refund_success',
  PROMO: 'promo',
  SYSTEM: 'system',
};

// ─── Coupon Types ─────────────────────────────────────────────────────────────
const COUPON_TYPE = {
  PERCENTAGE: 'percentage',
  FLAT: 'flat',
  FREE_SHIPPING: 'free_shipping',
  BUY_X_GET_Y: 'buy_x_get_y',
};

// ─── Cache TTL (seconds) ──────────────────────────────────────────────────────
const CACHE_TTL = {
  PRODUCT_LIST: 300,       // 5 min
  PRODUCT_DETAIL: 600,     // 10 min
  CATEGORY_LIST: 1800,     // 30 min
  USER_PROFILE: 300,       // 5 min
  ORDER_LIST: 60,          // 1 min
  ANALYTICS: 900,          // 15 min
  OTP: 600,                // 10 min
  BLOG_LIST: 300,          // 5 min
  BLOG_DETAIL: 600,        // 10 min
  SEARCH: 30,              // 30 sec — short TTL so results stay fresh
};

// ─── Pagination ───────────────────────────────────────────────────────────────
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// ─── Sort Options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = {
  NEWEST: '-createdAt',
  OLDEST: 'createdAt',
  PRICE_ASC: 'price',
  PRICE_DESC: '-price',
  RATING: '-averageRating',
  POPULAR: '-totalSold',
  FEATURED: '-isFeatured',
};

// ─── File Upload ──────────────────────────────────────────────────────────────
const UPLOAD = {
  MAX_SIZE_MB:              5,
  get MAX_SIZE_BYTES()      { return this.MAX_SIZE_MB * 1024 * 1024; },
  ALLOWED_MIME_TYPES:       ['image/jpeg', 'image/png', 'image/webp'],
  MAX_PRODUCT_IMAGES:       10,
  VIDEO_MAX_SIZE_MB:        100,
  get VIDEO_MAX_SIZE_BYTES(){ return this.VIDEO_MAX_SIZE_MB * 1024 * 1024; },
  ALLOWED_VIDEO_MIME_TYPES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
};

// ─── Token Types ──────────────────────────────────────────────────────────────
const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'reset_password',
  EMAIL_VERIFY: 'email_verify',
};

// ─── Environments ─────────────────────────────────────────────────────────────
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
  STAGING: 'staging',
};

// ─── API Response Messages ────────────────────────────────────────────────────
const MESSAGES = {
  // Auth
  REGISTER_SUCCESS: 'Registration successful. Please verify your email.',
  LOGIN_SUCCESS: 'Login successful.',
  LOGOUT_SUCCESS: 'Logout successful.',
  EMAIL_VERIFIED: 'Email verified successfully.',
  OTP_SENT: 'OTP sent successfully.',
  OTP_VERIFIED: 'OTP verified successfully.',
  OTP_INVALID: 'Invalid or expired OTP.',
  TOKEN_REFRESHED: 'Access token refreshed.',
  PASSWORD_RESET_EMAIL: 'Password reset link sent to your email.',
  PASSWORD_RESET_SUCCESS: 'Password reset successful.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_ALREADY_EXISTS: 'Email already registered.',
  ACCOUNT_NOT_VERIFIED: 'Please verify your email before logging in.',
  ACCOUNT_INACTIVE: 'Your account has been deactivated. Contact support.',
  GOOGLE_AUTH_SUCCESS: 'Google login successful.',
  GOOGLE_ACCOUNT_CREATED: 'Account created via Google.',
  GOOGLE_TOKEN_INVALID: 'Invalid Google token.',

  // Generic CRUD
  CREATED: 'Created successfully.',
  UPDATED: 'Updated successfully.',
  DELETED: 'Deleted successfully.',
  FETCHED: 'Fetched successfully.',
  NOT_FOUND: 'Resource not found.',

  // Products
  PRODUCT_NOT_FOUND: 'Product not found.',
  OUT_OF_STOCK: 'Product is out of stock.',
  INSUFFICIENT_STOCK: 'Insufficient stock available.',

  // Cart
  CART_ITEM_ADDED: 'Item added to cart.',
  CART_ITEM_REMOVED: 'Item removed from cart.',
  CART_UPDATED: 'Cart updated.',
  CART_CLEARED: 'Cart cleared.',

  // Order
  COD_CONFIRMED: 'COD order confirmed. ₹100 confirmation charge collected.',
  ORDER_PLACED: 'Order placed successfully.',
  COD_CHARGE_PAID: 'COD confirmation charge paid successfully.',
  ORDER_CANCELLED: 'Order cancelled successfully.',
  ORDER_CANCEL_FORBIDDEN: 'Order cannot be cancelled at this stage.',
  RETURN_REQUESTED: 'Return request submitted.',

  // Payment
  PAYMENT_INITIATED: 'Payment initiated.',
  PAYMENT_SUCCESS: 'Payment successful.',
  PAYMENT_FAILED: 'Payment failed.',
  PAYMENT_VERIFIED: 'Payment verified.',
  REFUND_INITIATED: 'Refund initiated.',
  INVALID_SIGNATURE: 'Invalid payment signature.',

  // Blog
  BLOG_NOT_FOUND: 'Blog not found.',
  BLOG_CREATED: 'Blog created successfully.',
  BLOG_PUBLISHED: 'Blog published successfully.',
  BLOG_UNPUBLISHED: 'Blog unpublished successfully.',

  // Home Videos
  VIDEO_NOT_FOUND: 'Video not found.',
  VIDEO_CREATED: 'Video created successfully.',
  VIDEO_UPDATED: 'Video updated successfully.',
  VIDEO_DELETED: 'Video deleted successfully.',

  // Server
  INTERNAL_ERROR: 'Internal server error.',
  UNAUTHORIZED: 'Authentication required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Validation failed.',
  RATE_LIMIT: 'Too many requests. Please try again later.',
};

module.exports = {
  HTTP_STATUS,
  ROLES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  COD_SETTINGS,
  NOTIFICATION_TYPE,
  COUPON_TYPE,
  CACHE_TTL,
  PAGINATION,
  SORT_OPTIONS,
  UPLOAD,
  TOKEN_TYPE,
  ENVIRONMENTS,
  MESSAGES,
  LEAD_STATUS,
  LEAD_SOURCE,
  FOLLOW_UP_STATUS,
};
