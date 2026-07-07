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
  sendSuccess(res, 'Lead fetched.', await leadService.getLeadById(req.params.id));
});

const updateLead = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Lead updated.', await leadService.updateLead(req.params.id, req.body, req.user.id));
});

const deleteLead = asyncHandler(async (req, res) => {
  await leadService.deleteLead(req.params.id, req.user.id);
  sendSuccess(res, 'Lead deleted.');
});

const restoreLead = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Lead restored.', await leadService.restoreLead(req.params.id, req.user.id));
});

// ─── Assignment ───────────────────────────────────────────────────────────────

const assignLead = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Lead assigned.', await leadService.assignLead(req.params.id, req.body.assignedToId, req.user.id));
});

// ─── CNP ──────────────────────────────────────────────────────────────────────

const markCNP = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Marked as CNP.', await leadService.markCNP(req.params.id, req.user.id));
});

const unmarkCNP = asyncHandler(async (req, res) => {
  sendSuccess(res, 'CNP cleared.', await leadService.unmarkCNP(req.params.id, req.user.id));
});

// ─── Notes ────────────────────────────────────────────────────────────────────

const addNote = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Note added.', await leadService.addNote(req.params.id, req.body, req.user.id), HTTP_STATUS.CREATED);
});

const getNotes = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Notes fetched.', await leadService.getNotes(req.params.id));
});

const deleteNote = asyncHandler(async (req, res) => {
  await leadService.deleteNote(req.params.id, req.params.noteId);
  sendSuccess(res, 'Note deleted.');
});

// ─── Follow-ups ───────────────────────────────────────────────────────────────

const addFollowUp = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Follow-up scheduled.', await leadService.addFollowUp(req.params.id, req.body, req.user.id), HTTP_STATUS.CREATED);
});

const getFollowUps = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Follow-ups fetched.', await leadService.getFollowUps(req.params.id));
});

const updateFollowUp = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Follow-up updated.', await leadService.updateFollowUp(req.params.id, req.params.followUpId, req.body, req.user.id));
});

const deleteFollowUp = asyncHandler(async (req, res) => {
  await leadService.deleteFollowUp(req.params.id, req.params.followUpId);
  sendSuccess(res, 'Follow-up deleted.');
});

// ─── Timeline & Analytics ─────────────────────────────────────────────────────

const getTimeline = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Timeline fetched.', await leadService.getTimeline(req.params.id));
});

const getLeadStats = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Lead stats fetched.', await leadService.getLeadStats());
});

const exportLeads = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Leads exported.', await leadService.exportLeads(req.query));
});

// ─── Public submissions (factory) ─────────────────────────────────────────────

const publicLeadHandler = (source, message) =>
  asyncHandler(async (req, res) => {
    const lead = await leadService.submitPublicLead(req.body, source);
    sendSuccess(res, message, { id: lead.id }, HTTP_STATUS.CREATED);
  });

const submitWebsiteLead     = publicLeadHandler('website',          'Inquiry submitted successfully.');
const submitFranchiseLead   = publicLeadHandler('franchise_form',   'Franchise inquiry submitted.');
const submitDistributorLead = publicLeadHandler('distributor_form', 'Distributor inquiry submitted.');

module.exports = {
  createLead, getLeads, getLead, updateLead, deleteLead, restoreLead,
  assignLead, markCNP, unmarkCNP,
  addNote, getNotes, deleteNote,
  addFollowUp, getFollowUps, updateFollowUp, deleteFollowUp,
  getTimeline, getLeadStats, exportLeads,
  submitWebsiteLead, submitFranchiseLead, submitDistributorLead,
};
