'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }, { emit: 'stdout', level: 'warn' }]
    : [{ emit: 'stdout', level: 'error' }],
});

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
  if (process.env.LOG_QUERIES === 'true') {
    // Top-level require — fixes lazy-load finding; logger is always available in dev.
    const logger = require('../utils/logger');
    prisma.$on('query', (e) => logger.debug(`Prisma (${e.duration}ms): ${e.query}`));
  }
}

module.exports = prisma;
