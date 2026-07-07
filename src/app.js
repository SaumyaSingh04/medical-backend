'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const xss          = require('xss-clean');
const hpp          = require('hpp');
const morgan       = require('morgan');
const path         = require('path');
const serveStatic  = require('serve-static');
const bcrypt       = require('bcryptjs');

const { specs }               = require('./config/swagger');
const prisma                  = require('./repositories/prismaClient');
const { generateAuthTokens }  = require('./helpers/tokenHelper');
const routes                  = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestLogger }       = require('./middleware/requestLogger');
const { generalLimiter }      = require('./middleware/rateLimiter');
const { analyticsMiddleware } = require('./middleware/analyticsMiddleware');
const logger                  = require('./utils/logger');
const { ROLES }               = require('./constants');

const app = express();

// ─── Trust Proxy (for Nginx / load balancers) ─────────────────────────────────
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts:           { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:', 'res.cloudinary.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com'],
      connectSrc:  ["'self'", 'cdn.jsdelivr.net'],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      // omit upgradeInsecureRequests in non-production (passing null is invalid)
      ...(isProd && { upgradeInsecureRequests: [] }),
    },
  },
  noSniff:                    true,
  frameguard:                 { action: 'deny' },
  xssFilter:                  true,
  dnsPrefetchControl:         { allow: false },
  ieNoOpen:                   true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

app.disable('x-powered-by');

// ─── No-cache for all API responses ──────────────────────────────────────────
const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};
app.use('/api/', noCache);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    'https://medical-backend-sand.vercel.app',
    'https://ayurecareweb.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
  ],
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
// cors() handles OPTIONS preflight automatically — no need for a separate app.options('*')
app.use(cors(corsOptions));

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(xss());
app.use(hpp({ whitelist: ['sort', 'fields', 'price', 'rating', 'category'] }));

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Request Logging ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip:   (req) => req.url === '/health',
  }));
}
app.use(requestLogger);

// ─── Static Files (local dev only) ──────────────────────────────────────────
if (!isProd) {
  app.use('/uploads', serveStatic(path.join(__dirname, '..', 'uploads'), {
    dotfiles:   'deny',
    index:      false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    },
  }));
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── Analytics Tracking ──────────────────────────────────────────────────────
app.use(analyticsMiddleware);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:      'ok',
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Dev-only routes (ENABLE_DEV_ROUTES=true + NODE_ENV=development only) ────
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_ROUTES === 'true') {
  // CWE-306 fix: require a shared secret so these routes cannot be called by
  // any process that can reach the server — only callers who know DEV_SECRET.
  const devAuth = (req, res, next) => {
    const secret = process.env.DEV_SECRET;
    if (!secret || req.headers['x-dev-secret'] !== secret) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    next();
  };

  app.get('/make-me-admin', devAuth, async (req, res) => {
    try {
      const email = process.env.DEV_ADMIN_EMAIL;
      if (!email) return res.status(400).json({ success: false, message: 'DEV_ADMIN_EMAIL env var not set.' });
      const user = await prisma.user.updateMany({
        where: { email },
        data:  { role: ROLES.ADMIN, isEmailVerified: true, isActive: true, loginAttempts: 0, lockUntil: null },
      });
      if (user.count === 0) return res.status(404).json({ success: false, message: 'Account not found. Please register first.' });
      res.json({ success: true, message: 'Upgraded to Admin.' });
    } catch {
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  app.get('/magic-login', devAuth, async (req, res) => {
    try {
      const email    = process.env.DEV_ADMIN_EMAIL;
      const password = process.env.DEV_ADMIN_PASSWORD;
      const phone    = process.env.DEV_ADMIN_PHONE || '9999999999';
      if (!email || !password) return res.status(400).json({ success: false, message: 'DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD env vars required.' });
      const hashed = await bcrypt.hash(password, 12);
      const user = await prisma.user.upsert({
        where:  { email },
        create: { firstName: 'Dev', lastName: 'Admin', email, phone, role: ROLES.ADMIN, isEmailVerified: true, isActive: true, password: hashed },
        update: { role: ROLES.ADMIN, isEmailVerified: true, isActive: true },
      });
      const { accessToken } = generateAuthTokens(user.id, ROLES.ADMIN);
      const redirectUrl = process.env.DEV_ADMIN_REDIRECT || 'http://localhost:3000/admin';
      res.json({ accessToken, redirectUrl });
    } catch {
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });
}

// ─── Swagger API Docs ────────────────────────────────────────────────────────
app.get('/api/v1/docs/swagger.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(specs);
});

app.get('/api/v1/docs', (req, res) => {
  const apiPrefix = process.env.API_PREFIX || '/api/v1';
  const specUrl   = `${apiPrefix}/docs/swagger.json`;

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Medical E-Commerce — API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" crossorigin="anonymous" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      background: #f0f4f8;
    }

    /* ── Top Banner ── */
    .api-banner {
      background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
      color: #fff;
      padding: 28px 40px 24px;
      display: flex;
      align-items: center;
      gap: 18px;
      box-shadow: 0 4px 20px rgba(0,0,0,.18);
    }
    .api-banner .logo {
      width: 52px; height: 52px;
      background: rgba(255,255,255,.15);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 26px;
    }
    .api-banner h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
    .api-banner p  { margin: 4px 0 0; font-size: 13px; opacity: .8; }
    .api-banner .badge {
      margin-left: auto;
      background: rgba(255,255,255,.2);
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 20px;
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: .5px;
    }

    /* ── Wrapper ── */
    #swagger-ui { max-width: 1280px; margin: 0 auto; padding: 28px 24px 60px; }

    /* ── Hide default topbar ── */
    .swagger-ui .topbar { display: none !important; }

    /* ── Info block ── */
    .swagger-ui .info { margin: 0 0 24px; }
    .swagger-ui .info .title { font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 700; color: #1a1a2e; }
    .swagger-ui .info p, .swagger-ui .info li { font-family: 'Inter', sans-serif; color: #444; }

    /* ── Scheme container (Authorize button row) ── */
    .swagger-ui .scheme-container {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.07);
      padding: 16px 24px;
      margin-bottom: 24px;
    }

    /* ── Tag sections ── */
    .swagger-ui .opblock-tag {
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
      border-bottom: 2px solid #e8edf3;
      padding-bottom: 8px;
    }
    .swagger-ui .opblock-tag:hover { background: transparent; }

    /* ── Operation blocks ── */
    .swagger-ui .opblock {
      border-radius: 10px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,.06) !important;
      margin-bottom: 10px !important;
      border: none !important;
      overflow: hidden;
    }
    .swagger-ui .opblock .opblock-summary {
      padding: 12px 16px;
      font-family: 'Inter', sans-serif;
    }
    .swagger-ui .opblock .opblock-summary-description {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #555;
    }

    /* Method colours */
    .swagger-ui .opblock.opblock-get    { background: #e8f4fd !important; border-left: 4px solid #1a73e8 !important; }
    .swagger-ui .opblock.opblock-post   { background: #e6f9f0 !important; border-left: 4px solid #0f9d58 !important; }
    .swagger-ui .opblock.opblock-put    { background: #fff8e1 !important; border-left: 4px solid #f9ab00 !important; }
    .swagger-ui .opblock.opblock-patch  { background: #fce8e6 !important; border-left: 4px solid #ea4335 !important; }
    .swagger-ui .opblock.opblock-delete { background: #fce8e6 !important; border-left: 4px solid #d93025 !important; }

    .swagger-ui .opblock-summary-method {
      border-radius: 6px !important;
      font-family: 'Inter', sans-serif !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      min-width: 70px !important;
      text-align: center !important;
    }

    /* ── Buttons ── */
    .swagger-ui .btn.authorize {
      background: #1a73e8 !important;
      border-color: #1a73e8 !important;
      color: #fff !important;
      border-radius: 8px !important;
      font-family: 'Inter', sans-serif !important;
      font-weight: 600 !important;
      padding: 8px 20px !important;
    }
    .swagger-ui .btn.authorize svg { fill: #fff !important; }
    .swagger-ui .btn.execute {
      background: #0f9d58 !important;
      border-color: #0f9d58 !important;
      border-radius: 8px !important;
      font-family: 'Inter', sans-serif !important;
      font-weight: 600 !important;
    }
    .swagger-ui .btn { border-radius: 8px !important; font-family: 'Inter', sans-serif !important; }

    /* ── Response / code blocks ── */
    .swagger-ui .responses-inner { background: #f8fafc; border-radius: 8px; padding: 12px; }
    .swagger-ui .microlight { font-size: 13px !important; }

    /* ── Models section ── */
    .swagger-ui section.models { border-radius: 12px; overflow: hidden; }
    .swagger-ui section.models h4 { font-family: 'Inter', sans-serif; font-weight: 600; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f0f4f8; }
    ::-webkit-scrollbar-thumb { background: #b0bec5; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="api-banner">
    <div class="logo">💊</div>
    <div>
      <h1>Medical E-Commerce API</h1>
      <p>Interactive REST API Documentation</p>
    </div>
    <span class="badge">v1.0.0</span>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script>
    SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: false,
      defaultModelsExpandDepth: -1,
      docExpansion: 'none',
    });
  </script>
</body>
</html>`);
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(process.env.API_PREFIX || '/api/v1', routes);

// ─── Root ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Medical E-Commerce API is running 🚀' });
});

// ─── 404 / Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
