const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const xss = require('xss-clean');
const hpp = require('hpp');
const morgan = require('morgan');
const path = require('path');

const { specs } = require('./config/swagger');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { analyticsMiddleware } = require('./middleware/analyticsMiddleware');
const logger = require('./utils/logger');

const app = express();

// ─── Trust Proxy (for Nginx / load balancers) ─────────────────────────────────
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'res.cloudinary.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    'https://medical-backend-sand.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(xss());            // Sanitize HTML input
app.use(hpp({              // HTTP Parameter Pollution protection
  whitelist: ['sort', 'fields', 'price', 'rating', 'category'],
}));

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Request Logging ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/health',
  }));
}
app.use(requestLogger);

// ─── Static Files (local dev only) ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── Analytics Tracking ──────────────────────────────────────────────────────
app.use(analyticsMiddleware);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Temporary Admin Setup (development only) ──────────────────────────────
if (process.env.NODE_ENV !== 'production') {
app.get('/make-me-admin', async (req, res) => {
  try {
    const prisma = require('./repositories/prismaClient');
    const bcrypt = require('bcryptjs');
    const email = 'saumya0419@gmail.com';
    const hashed = await bcrypt.hash('SecurePassword123', 12);
    const user = await prisma.user.updateMany({
      where: { email },
      data: { role: 'admin', isEmailVerified: true, isActive: true, password: hashed, loginAttempts: 0, lockUntil: null },
    });
    if (user.count === 0) return res.status(404).send('<h1>Error</h1><p>Account not found. Please register first.</p>');
    res.send('<h1>Success!</h1><p>Upgraded to Admin. Password reset to: <b>SecurePassword123</b></p>');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

app.get('/magic-login', async (req, res) => {
  try {
    const prisma = require('./repositories/prismaClient');
    const bcrypt = require('bcryptjs');
    const { generateAuthTokens } = require('./helpers/tokenHelper');
    const email = 'saumya0419@gmail.com';
    const hashed = await bcrypt.hash('SecurePassword123', 12);
    const user = await prisma.user.upsert({
      where: { email },
      create: { firstName: 'Saumya', lastName: 'Singh', email, phone: '6388691336', role: 'admin', isEmailVerified: true, isActive: true, password: hashed },
      update: { role: 'admin', isEmailVerified: true, isActive: true },
    });
    const { accessToken } = generateAuthTokens(user.id, 'admin');
    res.send(`<html><body><h1>Logging you in...</h1><script>localStorage.setItem('adminToken','${accessToken}');window.location.href='http://127.0.0.1:5500/Frontend/admin.html';</script></body></html>`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
}

// ─── Swagger API Docs ────────────────────────────────────────────────────────
// Serve raw OpenAPI JSON spec (used by swagger-ui CDN below)
app.get('/api/v1/docs/swagger.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(specs);
});

// Self-contained HTML page — loads swagger-ui from CDN, works on Vercel serverless
app.get('/api/v1/docs', (req, res) => {
  const specUrl = `${req.protocol}://${req.get('host')}/api/v1/docs/swagger.json`;
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Medical E-Commerce API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      persistAuthorization: true,
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

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
