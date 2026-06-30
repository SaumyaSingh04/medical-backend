'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Medical E-Commerce REST API',
      version: '1.0.0',
      description: 'Production-grade e-commerce backend API documentation',
      contact: {
        name: 'Medical API Support',
        email: 'saumya0419@gmail.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}/api/v1`,
        description: 'Development server',
      },
      {
        url: 'https://medical-backend-sand.vercel.app/api/v1',//change this
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & authorization — register, login, OTP, password reset' },
      { name: 'Users', description: 'User profile, addresses & wishlist management' },
      { name: 'Products', description: 'Product catalog — list, search, filter, CRUD (Admin)' },
      { name: 'Categories', description: 'Product categories & subcategory tree' },
      { name: 'Cart', description: 'Shopping cart — items, quantities & coupon application' },
      { name: 'Orders', description: 'Order placement, tracking, cancellation & returns' },
      { name: 'Payments', description: 'Payment processing — currently only COD is active' },
      { name: 'Reviews', description: 'Product reviews & ratings — create, update, vote helpful' },
      { name: 'Coupons', description: 'Discount coupon validation & management (Admin)' },
      { name: 'Admin', description: 'Admin panel — dashboard, users, products, orders & sales reports' },
      { name: 'Notifications', description: 'User notifications — read, mark as read & delete' },
      { name: 'Blogs', description: 'Blog post management — public listing & admin CRUD' },
      { name: 'Analytics', description: 'User analytics & activity tracking — Admin only' },
      { name: 'Videos', description: 'Home page video section — public listing, admin CRUD & add-to-cart' },
    ],
  },
  apis: [
    path.join(__dirname, '..', 'routes', '*.js'),
    path.join(__dirname, '..', 'models', '*.js'),
    path.join(__dirname, '..', 'docs', '*.yaml'),
  ],
};

const specs = swaggerJsdoc(options);

module.exports = { specs };
