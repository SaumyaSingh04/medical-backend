'use strict';

const leadRepo = require('../repositories/leadRepo');
const prisma   = require('../repositories/prismaClient');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const { addWhatsAppJob } = require('../jobs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').trim();
  if (p.startsWith('+91') && p.length === 13) p = p.slice(3);
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  else if (p.startsWith('+')) p = p.slice(1);
  return p.slice(-10);
}

// Only log meaningful events — status changes, assignments, CNP, follow-up completion, create/delete/restore
const TIMELINE_ACTIONS = new Set([
  'lead_created', 'lead_deleted', 'lead_restored',
  'status_changed', 'assigned',
  'cnp_marked', 'cnp_cleared',
  'followup_scheduled', 'followup_completed',
]);

async function addTimeline(leadId, action, detail, actorId, meta) {
  if (!TIMELINE_ACTIONS.has(action)) return; // skip noise
  return leadRepo.addTimeline({ leadId, action, detail, actorId: actorId || null, meta: meta || null });
}

// ─── Lead CRUD ────────────────────────────────────────────────────────────────

const createLead = async (data, createdById = null) => {
  if (data.phone) data.phone = normalizePhone(data.phone);

  const existing = await leadRepo.findOneIncludingDeleted({ phone: data.phone });
  if (existing) throw ApiError.conflict('A lead with this phone number already exists.');

  const lead = await leadRepo.create({
    ...data,
    createdById: createdById || undefined,
    assignedAt: data.assignedToId ? new Date() : undefined,
  });

  await addTimeline(lead.id, 'lead_created', `Lead created from ${lead.source}`, createdById);
  return lead;
};

const getLeads = async (queryParams) => {
  const { page, limit, skip } = parsePagination(queryParams);
  const [leads, total] = await Promise.all([
    leadRepo.findAll(queryParams, { skip, limit }),
    leadRepo.count(queryParams),
  ]);
  return { leads, meta: buildPaginationMeta(total, page, limit) };
};

const getLeadById = async (id) => {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found.');
  return lead;
};

const updateLead = async (id, data, actorId) => {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found.');

  if (data.phone) data.phone = normalizePhone(data.phone);

  const oldStatus = lead.status;
  const updated = await leadRepo.updateById(id, data);

  if (data.status && data.status !== oldStatus) {
    await addTimeline(id, 'status_changed', `${oldStatus} → ${data.status}`, actorId, { from: oldStatus, to: data.status });
  }

  return updated;
};

const deleteLead = async (id, actorId) => {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found.');
  await leadRepo.softDelete(id);
  await addTimeline(id, 'lead_deleted', 'Lead soft-deleted', actorId);
};

const restoreLead = async (id, actorId) => {
  const lead = await leadRepo.findByIdIncludingDeleted(id);
  if (!lead) throw ApiError.notFound('Lead not found.');
  if (!lead.isDeleted) throw ApiError.badRequest('Lead is not deleted.');
  const updated = await leadRepo.updateById(id, { isDeleted: false, deletedAt: null });
  await addTimeline(id, 'lead_restored', 'Lead restored', actorId);
  return updated;
};

// ─── Assignment ───────────────────────────────────────────────────────────────

const assignLead = async (id, assignedToId, actorId) => {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found.');

  const user = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, isActive: true } });
  if (!user || !user.isActive) throw ApiError.badRequest('Assignee not found or inactive.');

  const updated = await leadRepo.updateById(id, { assignedToId, assignedAt: new Date() });
  await addTimeline(id, 'assigned', 'Lead assigned', actorId, { assignedToId });
  return updated;
};

// ─── CNP ──────────────────────────────────────────────────────────────────────

const markCNP = async (id, actorId) => {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found.');
  const updated = await leadRepo.updateById(id, { status: 'cnp', cnpCount: lead.cnpCount + 1 });
  await addTimeline(id, 'cnp_marked', `CNP #${updated.cnpCount}`, actorId);
  return updated;
};

const unmarkCNP = async (id, actorId) => {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found.');
  const prevStatus = lead.status === 'cnp' ? 'contacted' : lead.status;
  const updated = await leadRepo.updateById(id, { status: prevStatus });
  await addTimeline(id, 'cnp_cleared', 'CNP cleared', actorId);
  return updated;
};

// ─── Notes ────────────────────────────────────────────────────────────────────

const addNote = async (leadId, { text, direction }, createdById) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  return leadRepo.createNote({ leadId, text, direction: direction || 'internal', createdById });
};

const getNotes = async (leadId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  return leadRepo.findNotes(leadId);
};

const deleteNote = async (leadId, noteId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  await leadRepo.deleteNote(noteId, leadId);
};

// ─── Follow-ups ───────────────────────────────────────────────────────────────

const addFollowUp = async (leadId, { scheduledAt, note }, createdById) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');

  const followUp = await leadRepo.createFollowUp({ leadId, scheduledAt: new Date(scheduledAt), note, createdById });
  await addTimeline(leadId, 'followup_scheduled', `Scheduled for ${scheduledAt}`, createdById);

  if (lead.phone) {
    const agentName = lead.assignedTo
      ? `${lead.assignedTo.firstName || ''} ${lead.assignedTo.lastName || ''}`.trim() || 'our team'
      : 'our team';
    addWhatsAppJob('sendLeadFollowUp', lead.phone, [lead.name || 'Customer', agentName]).catch(() => {});
  }

  return followUp;
};

const getFollowUps = async (leadId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  return leadRepo.findFollowUps(leadId);
};

const updateFollowUp = async (leadId, followUpId, data, actorId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  if (data.status === 'completed' && !data.completedAt) data.completedAt = new Date();
  const updated = await leadRepo.updateFollowUp(followUpId, data);
  if (data.status === 'completed') {
    await addTimeline(leadId, 'followup_completed', 'Follow-up completed', actorId);
  }
  return updated;
};

const deleteFollowUp = async (leadId, followUpId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  await leadRepo.deleteFollowUp(followUpId);
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

const getTimeline = async (leadId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) throw ApiError.notFound('Lead not found.');
  return leadRepo.findTimeline(leadId);
};

// ─── Analytics ────────────────────────────────────────────────────────────────

const getLeadStats = async () => {
  const now = new Date();
  const [byStatus, bySource, total, overdueFollowUps] = await Promise.all([
    leadRepo.countByStatus(),
    leadRepo.countBySource(),
    leadRepo.count(),
    prisma.leadFollowUp.count({ where: { status: 'scheduled', scheduledAt: { lt: now } } }),
  ]);

  const converted = byStatus.find(r => r.status === 'converted')?._count.id || 0;

  return {
    total,
    conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    overdueFollowUps,
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count.id })),
    bySource: bySource.map(r => ({ source: r.source, count: r._count.id })),
  };
};

const exportLeads = async (filter) => leadRepo.findAllForExport(filter);

// ─── Public form submissions ──────────────────────────────────────────────────

const submitPublicLead = async (body, source) => {
  const { name, phone, email, problem, city, state, pincode, address, ...rest } = body;
  const formData = Object.keys(rest).length ? rest : undefined;
  return createLead({ name, phone, email, problem, city, state, pincode, address, source, formData }, null);
};

module.exports = {
  createLead, getLeads, getLeadById, updateLead, deleteLead, restoreLead,
  assignLead, markCNP, unmarkCNP,
  addNote, getNotes, deleteNote,
  addFollowUp, getFollowUps, updateFollowUp, deleteFollowUp,
  getTimeline, getLeadStats, exportLeads, submitPublicLead,
};
