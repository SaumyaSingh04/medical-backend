'use strict';

const prisma = require('./prismaClient');

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

class VideoRepository {
  findAll({ isActive, limit = 20 } = {}) {
    const where = {};
    if (isActive !== undefined) where.isActive = isActive;
    return prisma.homeVideo.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      include: { product: { select: PRODUCT_SELECT } },
    });
  }

  findById(id) {
    return prisma.homeVideo.findUnique({
      where: { id },
      include: { product: { select: PRODUCT_SELECT } },
    });
  }

  create(data) {
    return prisma.homeVideo.create({
      data,
      include: { product: { select: PRODUCT_SELECT } },
    });
  }

  update(id, data) {
    return prisma.homeVideo.update({
      where: { id },
      data,
      include: { product: { select: PRODUCT_SELECT } },
    });
  }

  remove(id) {
    return prisma.homeVideo.delete({ where: { id } });
  }

  reorder(updates) {
    return prisma.$transaction(
      updates.map(({ id, sortOrder }) =>
        prisma.homeVideo.update({ where: { id }, data: { sortOrder } })
      )
    );
  }
}

module.exports = new VideoRepository();
