'use strict';

const { extractBearerToken, verifyToken } = require('../helpers/tokenHelper');
const prisma = require('../repositories/prismaClient');
const ApiError = require('../helpers/ApiError');
const { TOKEN_TYPE } = require('../constants');

// Tiny in-process cache: userId → { user, expiresAt }
// Avoids a DB round-trip on every request for the same user within the TTL window.
const USER_CACHE_TTL_MS = 30_000; // 30 s
const _userCache = new Map();

async function fetchAuthUser(userId) {
  const now = Date.now();
  const cached = _userCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.user;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, isActive: true, isEmailVerified: true },
  });

  if (user) _userCache.set(userId, { user, expiresAt: now + USER_CACHE_TTL_MS });
  return user;
}

// Evict stale entries every 5 minutes to prevent unbounded Map growth.
const _evictTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of _userCache) {
    if (entry.expiresAt <= now) _userCache.delete(id);
  }
}, 5 * 60_000);
_evictTimer.unref();

const authenticate = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization) || req.cookies?.accessToken;
    if (!token) throw ApiError.unauthorized();

    const payload = verifyToken(token, TOKEN_TYPE.ACCESS);
    if (payload.tokenType !== TOKEN_TYPE.ACCESS) throw ApiError.unauthorized('Invalid token type.');

    const user = await fetchAuthUser(payload.userId);
    if (!user) throw ApiError.unauthorized('User no longer exists.');
    if (!user.isActive) throw ApiError.forbidden('Account is inactive.');

    req.user = { id: user.id, role: user.role, email: user.email, isEmailVerified: user.isEmailVerified };
    next();
  } catch (err) {
    next(err);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
      const payload = verifyToken(token, TOKEN_TYPE.ACCESS);
      if (payload.tokenType === TOKEN_TYPE.ACCESS) {
        const user = await fetchAuthUser(payload.userId);
        if (user?.isActive) {
          req.user = { id: user.id, role: user.role, email: user.email, isEmailVerified: user.isEmailVerified };
        }
      }
    }
  } catch { /* ignore — optional auth never blocks */ }
  next();
};

module.exports = { authenticate, optionalAuth };
