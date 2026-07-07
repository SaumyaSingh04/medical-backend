'use strict';

const prisma = require('../repositories/prismaClient');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');

const submitContact = async ({ name, email, phone, subject, message }) => {
  return prisma.contactQuery.create({
    data: { name, email, phone, subject, message },
  });
};

const listContacts = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const where = query.status ? { status: query.status } : {};
  const [data, total] = await Promise.all([
    prisma.contactQuery.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.contactQuery.count({ where }),
  ]);
  return { data, meta: buildPaginationMeta(total, page, limit) };
};

const updateContactStatus = async (id, status, adminNote) => {
  const contact = await prisma.contactQuery.findUnique({ where: { id } });
  if (!contact) throw ApiError.notFound('Contact query not found.');
  return prisma.contactQuery.update({
    where: { id },
    data: { status, ...(adminNote !== undefined && { adminNote }) },
  });
};

module.exports = { submitContact, listContacts, updateContactStatus };
