'use strict';

const blogService = require('../services/blogService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, HTTP_STATUS } = require('../constants');

const listBlogs = asyncHandler(async (req, res) => {
  const { blogs, meta } = await blogService.listBlogs(req.query);
  sendPaginated(res, MESSAGES.FETCHED, blogs, meta);
});

const getBlog = asyncHandler(async (req, res) => {
  const blog = await blogService.getBlogBySlug(req.params.slug);
  sendSuccess(res, MESSAGES.FETCHED, blog);
});

const searchBlogs = asyncHandler(async (req, res) => {
  const { blogs, meta } = await blogService.searchBlogs(req.query.q, req.query);
  sendPaginated(res, MESSAGES.FETCHED, blogs, meta);
});

const getFeaturedBlogs = asyncHandler(async (req, res) => {
  const blogs = await blogService.getFeaturedBlogs(parseInt(req.query.limit, 10) || 6);
  sendSuccess(res, MESSAGES.FETCHED, blogs);
});

const listAllAdmin = asyncHandler(async (req, res) => {
  const { blogs, meta } = await blogService.listAllAdmin(req.query);
  sendPaginated(res, MESSAGES.FETCHED, blogs, meta);
});

const getBlogAdmin = asyncHandler(async (req, res) => {
  const blog = await blogService.getBlogByIdAdmin(req.params.id);
  sendSuccess(res, MESSAGES.FETCHED, blog);
});

const createBlog = asyncHandler(async (req, res) => {
  const blog = await blogService.createBlog(req.body, req.file, req.user.id);
  sendSuccess(res, MESSAGES.BLOG_CREATED, blog, HTTP_STATUS.CREATED);
});

const updateBlog = asyncHandler(async (req, res) => {
  const blog = await blogService.updateBlog(req.params.id, req.body, req.file);
  sendSuccess(res, MESSAGES.UPDATED, blog);
});

const deleteBlog = asyncHandler(async (req, res) => {
  const result = await blogService.deleteBlog(req.params.id);
  sendSuccess(res, result.message);
});

const publishBlog = asyncHandler(async (req, res) => {
  const blog = await blogService.publishBlog(req.params.id);
  sendSuccess(res, MESSAGES.BLOG_PUBLISHED, blog);
});

const unpublishBlog = asyncHandler(async (req, res) => {
  const blog = await blogService.unpublishBlog(req.params.id);
  sendSuccess(res, MESSAGES.BLOG_UNPUBLISHED, blog);
});

const likeBlog = asyncHandler(async (req, res) => {
  const blog = await blogService.likeBlog(req.params.id);
  sendSuccess(res, 'Liked.', blog);
});

module.exports = {
  listBlogs, getBlog, searchBlogs, getFeaturedBlogs,
  listAllAdmin, getBlogAdmin, createBlog, updateBlog,
  deleteBlog, publishBlog, unpublishBlog, likeBlog,
};
