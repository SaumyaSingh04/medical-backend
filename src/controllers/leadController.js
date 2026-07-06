'use strict';

const leadService = require('../services/leadService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HTTP_STATUS } = require('../constants');

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const createLead = asyncHandler(async (req, res) => {
  const lead = await leadService.createLead(req.body, req.user.id);
  sendSuccess(res, 'Lead created.', lead, HTTP_STATUS.CREATED);
});

const getLeads = asyncHandler(async (req, res) => {
  const { leads, meta } = await leadService.getLeads(req.query);
  sendPaginated(res, 'Leads fetched.', leads, meta);
});

const getLead = asyncHandler(async (req, res) => {
  const lead = await leadService.getLeadById(req.params.id);
  sendSuccess(res, 'Lead fetched.', lead);
});

const updateLead = asyncHandler(async (req, res) => {
  const lead = await leadService.updateLead(req.params.id, req.body, req.user.id);
  sendSuccess(res, 'Lead updated.', lead);
});

const deleteLead = asyncHandler(async (req, res) => {
  await leadService.deleteLead(req.params.id, req.user.id);
  sendSuccess(res, 'Lead deleted.');
});

// ─── Assignment ───────────────────────────────────────────────────────────────

const assignLead = asyncHandler(async (req, res) => {
  const lead = await leadService.assignLead(req.params.id, req.body.assignedToId, req.user.id);
  sendSuccess(res, 'Lead assigned.', lead);
});

// ─── CNP ──────────────────────────────────────────────────────────────────────

const markCNP = asyncHandler(async (req, res) => {
  const lead = await leadService.markCNP(req.params.id, req.user.id);
  sendSuccess(res, 'Marked as CNP.', lead);
});

const unmarkCNP = asyncHandler(async (req, res) => {
  const lead = await leadService.unmarkCNP(req.params.id, req.user.id);
  sendSuccess(res, 'CNP cleared.', lead);
});

// ─── Notes ────────────────────────────────────────────────────────────────────

const addNote = asyncHandler(async (req, res) => {
  const note = await leadService.addNote(req.params.id, req.body, req.user.id);
  sendSuccess(res, 'Note added.', note, HTTP_STATUS.CREATED);
});

const getNotes = asyncHandler(async (req, res) => {
  const notes = await leadService.getNotes(req.params.id);
  sendSuccess(res, 'Notes fetched.', notes);
});

const deleteNote = asyncHandler(async (req, res) => {
  await leadService.deleteNote(req.params.id, req.params.noteId);
  sendSuccess(res, 'Note deleted.');
});

// ─── Follow-ups ───────────────────────────────────────────────────────────────

const addFollowUp = asyncHandler(async (req, res) => {
  const followUp = await leadService.addFollowUp(req.params.id, req.body, req.user.id);
  sendSuccess(res, 'Follow-up scheduled.', followUp, HTTP_STATUS.CREATED);
});

const getFollowUps = asyncHandler(async (req, res) => {
  const followUps = await leadService.getFollowUps(req.params.id);
  sendSuccess(res, 'Follow-ups fetched.', followUps);
});

const updateFollowUp = asyncHandler(async (req, res) => {
  const followUp = await leadService.updateFollowUp(req.params.id, req.params.followUpId, req.body, req.user.id);
  sendSuccess(res, 'Follow-up updated.', followUp);
});

const deleteFollowUp = asyncHandler(async (req, res) => {
  await leadService.deleteFollowUp(req.params.id, req.params.followUpId);
  sendSuccess(res, 'Follow-up deleted.');
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

const getTimeline = asyncHandler(async (req, res) => {
  const timeline = await leadService.getTimeline(req.params.id);
  sendSuccess(res, 'Timeline fetched.', timeline);
});

// ─── Analytics ────────────────────────────────────────────────────────────────

const getLeadStats = asyncHandler(async (req, res) => {
  const stats = await leadService.getLeadStats();
  sendSuccess(res, 'Lead stats fetched.', stats);
});

const exportLeads = asyncHandler(async (req, res) => {
  const leads = await leadService.exportLeads(req.query);
  sendSuccess(res, 'Leads exported.', leads);
});

// ─── Restore ──────────────────────────────────────────────────────────────────

const restoreLead = asyncHandler(async (req, res) => {
  const lead = await leadService.restoreLead(req.params.id, req.user.id);
  sendSuccess(res, 'Lead restored.', lead);
});

// ─── Public ───────────────────────────────────────────────────────────────────

const submitWebsiteLead = asyncHandler(async (req, res) => {
  const lead = await leadService.submitPublicLead(req.body, 'website');
  sendSuccess(res, 'Inquiry submitted successfully.', { id: lead.id }, HTTP_STATUS.CREATED);
});

const submitFranchiseLead = asyncHandler(async (req, res) => {
  const lead = await leadService.submitPublicLead(req.body, 'franchise_form');
  sendSuccess(res, 'Franchise inquiry submitted.', { id: lead.id }, HTTP_STATUS.CREATED);
});

const submitDistributorLead = asyncHandler(async (req, res) => {
  const lead = await leadService.submitPublicLead(req.body, 'distributor_form');
  sendSuccess(res, 'Distributor inquiry submitted.', { id: lead.id }, HTTP_STATUS.CREATED);
});

module.exports = {
  createLead, getLeads, getLead, updateLead, deleteLead, restoreLead,
  assignLead, markCNP, unmarkCNP,
  addNote, getNotes, deleteNote,
  addFollowUp, getFollowUps, updateFollowUp, deleteFollowUp,
  getTimeline, getLeadStats, exportLeads,
  submitWebsiteLead, submitFranchiseLead, submitDistributorLead,
};
