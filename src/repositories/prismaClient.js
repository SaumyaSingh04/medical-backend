'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma ?? new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

// Handle Neon / any PostgreSQL idle connection termination gracefully.
// When the DB kills the connection (E57P01 / ECONNRESET), Prisma emits this
// internal event. We catch it so it never surfaces as an unhandled rejection.
prisma.$on('error', () => {});

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  // Suppress Neon idle-timeout disconnects — Prisma reconnects automatically
  if (
    msg.includes('E57P01') ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('Connection is closed') ||
    msg.includes('ECONNRESET')
  ) return;
  // Re-throw everything else so real errors are still visible
  console.error('[unhandledRejection]', reason);
});

module.exports = prisma;
