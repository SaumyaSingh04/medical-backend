'use strict';

const prisma = require('./prismaClient');

// Shared product select — used in all 4 methods for consistent response shape
const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  thumbnailUrl: true,
  stock: true,
  isActive: true,
  hasVariants: true,
  variants: true,
};

const findAll = ({ isActive, limit = 20 } = {}) => {
  const where = {};
  if (isActive !== undefined) where.isActive = isActive;

  return prisma.homeVideo.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    include: { product: { select: PRODUCT_SELECT } },
  });
};

const findById = (id) =>
  prisma.homeVideo.findUnique({
    where: { id },
    include: { product: { select: PRODUCT_SELECT } },
  });

const create = (data) =>
  prisma.homeVideo.create({
    data,
    include: { product: { select: PRODUCT_SELECT } },
  });

const update = (id, data) =>
  prisma.homeVideo.update({
    where: { id },
    data,
    include: { product: { select: PRODUCT_SELECT } },
  });

const remove = (id) => prisma.homeVideo.delete({ where: { id } });

const reorder = (updates) =>
  prisma.$transaction(
    updates.map(({ id, sortOrder }) =>
      prisma.homeVideo.update({ where: { id }, data: { sortOrder } })
    )
  );

module.exports = { findAll, findById, create, update, remove, reorder };
