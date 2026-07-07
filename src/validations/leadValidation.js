'use strict';

const Joi = require('joi');
const { id, email, isoDate, pagination } = require('./common');

const STATUSES = ['new', 'contacted', 'follow_up', 'cnp', 'interested', 'not_interested', 'converted', 'lost'];
const SOURCES  = ['website', 'whatsapp', 'social_media', 'referral', 'manual', 'contact_form', 'franchise_form', 'distributor_form'];

// Shared nullable-string helper for optional lead text fields
const nullableStr = (max) => Joi.string().trim().max(max).allow('', null).optional();

const createLead = Joi.object({
  name:         Joi.string().trim().min(1).max(100).required(),
  phone:        Joi.string().trim().min(7).max(15).required(),
  email:        email().allow('', null).optional(),
  problem:      nullableStr(500),
  address:      nullableStr(500),
  city:         nullableStr(100),
  state:        nullableStr(100),
  pincode:      nullableStr(10),
  source:       Joi.string().valid(...SOURCES).optional(),
  status:       Joi.string().valid(...STATUSES).optional(),
  assignedToId: id().allow(null).optional(),
  formData:     Joi.object().unknown(true).allow(null).optional(),
});

// All createLead fields become optional; orderId added only for updates
const updateLead = createLead
  .fork(Object.keys(createLead.describe().keys), (s) => s.optional())
  .keys({ orderId: id().allow(null).optional() });

const assignLead = Joi.object({
  assignedToId: id().required(),
});

const addNote = Joi.object({
  text:      Joi.string().trim().min(1).max(2000).required(),
  direction: Joi.string().valid('internal', 'inbound', 'outbound').optional(),
});

const addFollowUp = Joi.object({
  scheduledAt: Joi.date().iso().required(),
  note:        nullableStr(1000),
});

const updateFollowUp = Joi.object({
  status:      Joi.string().valid('scheduled', 'completed', 'missed').optional(),
  completedAt: Joi.date().iso().allow(null).optional(),
  note:        nullableStr(1000),
  scheduledAt: Joi.date().iso().optional(),
});

const listLeads = Joi.object({
  ...pagination,
  status:       Joi.string().valid(...STATUSES).optional(),
  source:       Joi.string().valid(...SOURCES).optional(),
  assignedToId: id().optional(),
  createdById:  id().optional(),
  search:       Joi.string().trim().optional(),
  from:         isoDate().optional(),
  to:           isoDate().optional(),
  isDeleted:    Joi.boolean().optional(),
});

// Public form submissions (franchise / distributor) — subset of createLead fields
const PUBLIC_LEAD_KEYS = ['name', 'phone', 'email', 'problem', 'city', 'state', 'pincode', 'address'];
const publicSubmit = createLead
  .fork(Object.keys(createLead.describe().keys), (s) => s.optional())
  .fork(PUBLIC_LEAD_KEYS.filter((k) => ['name', 'phone'].includes(k)), (s) => s.required())
  .unknown(true); // allow extra form fields stored in formData

module.exports = { createLead, updateLead, assignLead, addNote, addFollowUp, updateFollowUp, listLeads, publicSubmit };
