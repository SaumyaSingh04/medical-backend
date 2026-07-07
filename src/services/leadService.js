'use strict';

const leadRepo = require('../repositories/leadRepo');
const prisma   = require('../repositories/prismaClient');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const { addWhatsAppJob } = require('../jobs');

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').trim();
  if (p.startsWith('+91') && p.length === 13) p = p.slice(3);
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  else if (p.startsWith('+')) p = p.slice(1);
  return p.slice(-10);
}

const TIMELINE_ACTIONS = new Set([
  'lead_created', 'lead_deleted', 'lead_restored',
  'status_changed', 'assigned',
  'cnp_marked', 'cnp_cleared',
  'followup_scheduled', 'followup_completed',
]);

async function addTimeline(leadId, action, detail, actorId, meta) {
  if (!TIMELINE_ACTIONS.has(action)) return;
  return leadRepo.addTimeline({ leadId, action, detail, actorId: actorId || null, meta: meta || null });
}

class LeadService {
  async _requireLead(id) {
    const lead = await leadRepo.findById(id);
    if (!lead) throw ApiError.notFound('Lead not found.');
    return lead;
  }

  async createLead(data, createdById = null) {
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
  }

  async getLeads(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const [leads, total] = await Promise.all([
      leadRepo.findAll(queryParams, { skip, limit }),
      leadRepo.count(queryParams),
    ]);
    return { leads, meta: buildPaginationMeta(total, page, limit) };
  }

  async getLeadById(id) {
    return this._requireLead(id);
  }

  async updateLead(id, data, actorId) {
    const lead = await this._requireLead(id);
    if (data.phone) data.phone = normalizePhone(data.phone);
    const oldStatus = lead.status;
    const updated = await leadRepo.updateById(id, data);
    if (data.status && data.status !== oldStatus) {
      await addTimeline(id, 'status_changed', `${oldStatus} → ${data.status}`, actorId, { from: oldStatus, to: data.status });
    }
    return updated;
  }

  async deleteLead(id, actorId) {
    await this._requireLead(id);
    await leadRepo.softDelete(id);
    await addTimeline(id, 'lead_deleted', 'Lead soft-deleted', actorId);
  }

  async restoreLead(id, actorId) {
    const lead = await leadRepo.findByIdIncludingDeleted(id);
    if (!lead) throw ApiError.notFound('Lead not found.');
    if (!lead.isDeleted) throw ApiError.badRequest('Lead is not deleted.');
    const updated = await leadRepo.updateById(id, { isDeleted: false, deletedAt: null });
    await addTimeline(id, 'lead_restored', 'Lead restored', actorId);
    return updated;
  }

  async assignLead(id, assignedToId, actorId) {
    await this._requireLead(id);
    const user = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, isActive: true } });
    if (!user || !user.isActive) throw ApiError.badRequest('Assignee not found or inactive.');
    const updated = await leadRepo.updateById(id, { assignedToId, assignedAt: new Date() });
    await addTimeline(id, 'assigned', 'Lead assigned', actorId, { assignedToId });
    return updated;
  }

  async markCNP(id, actorId) {
    const lead = await this._requireLead(id);
    const updated = await leadRepo.updateById(id, { status: 'cnp', cnpCount: lead.cnpCount + 1 });
    await addTimeline(id, 'cnp_marked', `CNP #${updated.cnpCount}`, actorId);
    return updated;
  }

  async unmarkCNP(id, actorId) {
    const lead = await this._requireLead(id);
    const prevStatus = lead.status === 'cnp' ? 'contacted' : lead.status;
    const updated = await leadRepo.updateById(id, { status: prevStatus });
    await addTimeline(id, 'cnp_cleared', 'CNP cleared', actorId);
    return updated;
  }

  async addNote(leadId, { text, direction }, createdById) {
    await this._requireLead(leadId);
    return leadRepo.createNote({ leadId, text, direction: direction || 'internal', createdById });
  }

  async getNotes(leadId) {
    await this._requireLead(leadId);
    return leadRepo.findNotes(leadId);
  }

  async deleteNote(leadId, noteId) {
    await this._requireLead(leadId);
    await leadRepo.deleteNote(noteId, leadId);
  }

  async addFollowUp(leadId, { scheduledAt, note }, createdById) {
    const lead = await this._requireLead(leadId);
    const followUp = await leadRepo.createFollowUp({ leadId, scheduledAt: new Date(scheduledAt), note, createdById });
    await addTimeline(leadId, 'followup_scheduled', `Scheduled for ${scheduledAt}`, createdById);
    if (lead.phone) {
      const agentName = lead.assignedTo
        ? `${lead.assignedTo.firstName || ''} ${lead.assignedTo.lastName || ''}`.trim() || 'our team'
        : 'our team';
      addWhatsAppJob('sendLeadFollowUp', lead.phone, [lead.name || 'Customer', agentName]).catch(() => {});
    }
    return followUp;
  }

  async getFollowUps(leadId) {
    await this._requireLead(leadId);
    return leadRepo.findFollowUps(leadId);
  }

  async updateFollowUp(leadId, followUpId, data, actorId) {
    await this._requireLead(leadId);
    if (data.status === 'completed' && !data.completedAt) data.completedAt = new Date();
    const updated = await leadRepo.updateFollowUp(followUpId, data);
    if (data.status === 'completed') {
      await addTimeline(leadId, 'followup_completed', 'Follow-up completed', actorId);
    }
    return updated;
  }

  async deleteFollowUp(leadId, followUpId) {
    await this._requireLead(leadId);
    await leadRepo.deleteFollowUp(followUpId);
  }

  async getTimeline(leadId) {
    await this._requireLead(leadId);
    return leadRepo.findTimeline(leadId);
  }

  async getLeadStats() {
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
  }

  exportLeads(filter) {
    return leadRepo.findAllForExport(filter);
  }

  async submitPublicLead(body, source) {
    const { name, phone, email, problem, city, state, pincode, address, ...rest } = body;
    const formData = Object.keys(rest).length ? rest : undefined;
    return this.createLead({ name, phone, email, problem, city, state, pincode, address, source, formData }, null);
  }
}

module.exports = new LeadService();
