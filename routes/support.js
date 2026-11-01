import { Router } from "express";

import {
  createConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  reopenConversation,
  authorizeSupportAccess,
} from "../controllers/support.js";

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
  createConversationSchema,
  getMyConversationsSchema,
  getConversationMessagesParamsSchema,
  getConversationMessagesQuerySchema,
  sendMessageParamsSchema,
  sendMessageBodySchema,
  reopenConversationSchema,
} from "../validation/support.js";

const router = Router();

// ==========================================
// AUTHORIZATION
// ==========================================

// All support endpoints require:
// 1. A valid authenticated school user.
// 2. An authorized school administrator or owner.

router.use(
  protectRoutes,
  authorizeSupportAccess
);

// ==========================================
// POST /api/support
// Create a support conversation
// ==========================================

router.post(
  "/",
  validate(createConversationSchema, "body"),
  createConversation
);

// ==========================================
// GET /api/support?page=1&limit=20&status=OPEN
// Get my support conversations
// ==========================================

router.get(
  "/",
  validate(getMyConversationsSchema, "query"),
  getMyConversations
);

// ==========================================
// GET /api/support/:conversationId/messages
// Get conversation messages
// ==========================================

router.get(
  "/:conversationId/messages",
  validate(getConversationMessagesParamsSchema, "params"),
  validate(getConversationMessagesQuerySchema, "query"),
  getConversationMessages
);

// ==========================================
// POST /api/support/:conversationId/messages
// Send a message
// ==========================================

router.post(
  "/:conversationId/messages",
  validate(sendMessageParamsSchema, "params"),
  validate(sendMessageBodySchema, "body"),
  sendMessage
);

// ==========================================
// PATCH /api/support/:conversationId/reopen
// Reopen a resolved conversation
// ==========================================

router.patch(
  "/:conversationId/reopen",
  validate(reopenConversationSchema, "params"),
  reopenConversation
);

export default router;