'use strict';

const prisma = require('./prismaClient');

// ─── Selects ──────────────────────────────────────────────────────────────────
const LEAD_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  problem: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  source: true,
  status: true,
  cnpCount: true,
  isDeleted: true,
  deletedAt: true,
  assignedToId: true,
  assignedAt: true,
  orderId: true,
  formData: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
};

const NOTE_SELECT = {
  id: true,
  leadId: true,
  text: true,
  direction: true,
  createdById: true,
  createdAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

const FOLLOWUP_SELECT = {
  id: true,
  leadId: true,
  scheduledAt: true,
  completedAt: true,
  status: true,
  note: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildWhere(filter = {}) {
  const where = { isDeleted: false };
  if (filter.status)       where.status = filter.status;
  if (filter.source)       where.source = filter.source;
  if (filter.assignedToId) where.assignedToId = filter.assignedToId;
  if (filter.createdById)  where.createdById = filter.createdById;
  if (filter.isDeleted !== undefined) where.isDeleted = filter.isDeleted;

  if (filter.search) {
    where.OR = [
      { name:  { contains: filter.search, mode: 'insensitive' } },
      { phone: { contains: filter.search, mode: 'insensitive' } },
      { email: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = new Date(filter.from);
    if (filter.to)   where.createdAt.lte = new Date(filter.to + 'T23:59:59.999Z');
  }
  return where;
}

// ─── Lead CRUD ────────────────────────────────────────────────────────────────
class LeadRepository {
  async create(data) {
    return prisma.lead.create({ data, select: LEAD_SELECT });
  }

  async findById(id) {
    return prisma.lead.findFirst({
      where: { id, isDeleted: false },
      select: LEAD_SELECT,
    });
  }

  async findByIdIncludingDeleted(id) {
    return prisma.lead.findFirst({ where: { id }, select: LEAD_SELECT });
  }

  async findOne(filter) {
    return prisma.lead.findFirst({ where: buildWhere(filter), select: LEAD_SELECT });
  }

  async findOneIncludingDeleted(filter) {
    // Bypasses the isDeleted: false guard — used for duplicate phone checks
    const where = {};
    if (filter.phone) where.phone = filter.phone;
    return prisma.lead.findFirst({ where, select: LEAD_SELECT });
  }

  async findAll(filter = {}, { skip = 0, limit = 20 } = {}) {
    return prisma.lead.findMany({
      where: buildWhere(filter),
      select: LEAD_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async count(filter = {}) {
    return prisma.lead.count({ where: buildWhere(filter) });
  }

  async updateById(id, data) {
    return prisma.lead.update({ where: { id }, data, select: LEAD_SELECT });
  }

  // Soft delete
  async softDelete(id) {
    return prisma.lead.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
      select: LEAD_SELECT,
    });
  }

  // ─── Notes ──────────────────────────────────────────────────────────────────
  async createNote(data) {
    return prisma.leadNote.create({ data, select: NOTE_SELECT });
  }

  async findNotes(leadId) {
    return prisma.leadNote.findMany({
      where: { leadId },
      select: NOTE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteNote(id, leadId) {
    return prisma.leadNote.deleteMany({ where: { id, leadId } });
  }

  // ─── Follow-ups ─────────────────────────────────────────────────────────────
  async createFollowUp(data) {
    return prisma.leadFollowUp.create({ data, select: FOLLOWUP_SELECT });
  }

  async findFollowUps(leadId) {
    return prisma.leadFollowUp.findMany({
      where: { leadId },
      select: FOLLOWUP_SELECT,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async updateFollowUp(id, data) {
    return prisma.leadFollowUp.update({ where: { id }, data, select: FOLLOWUP_SELECT });
  }

  async deleteFollowUp(id) {
    return prisma.leadFollowUp.delete({ where: { id } });
  }

  // ─── Timeline ───────────────────────────────────────────────────────────────
  async addTimeline(data) {
    return prisma.leadTimeline.create({
      data,
      select: {
        id: true, leadId: true, action: true, detail: true, meta: true, actorId: true, createdAt: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findTimeline(leadId) {
    return prisma.leadTimeline.findMany({
      where: { leadId },
      select: {
        id: true, leadId: true, action: true, detail: true, meta: true, actorId: true, createdAt: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Analytics helpers ───────────────────────────────────────────────────────
  async countByStatus() {
    return prisma.lead.groupBy({
      by: ['status'],
      where: { isDeleted: false },
      _count: { id: true },
    });
  }

  async countBySource() {
    return prisma.lead.groupBy({
      by: ['source'],
      where: { isDeleted: false },
      _count: { id: true },
    });
  }

  async findAllForExport(filter = {}) {
    return prisma.lead.findMany({
      where: buildWhere(filter),
      select: {
        id: true, name: true, email: true, phone: true, problem: true,
        city: true, state: true, pincode: true, source: true, status: true,
        cnpCount: true, createdAt: true, updatedAt: true,
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new LeadRepository();
