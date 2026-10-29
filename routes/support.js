
import { Router } from "express";

import {
  createConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  reopenConversation,
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


// POST /api/support
router.post(
  "/",
  validate(createConversationSchema, "body"),
  createConversation
);

// GET /api/support?page=1&limit=20&status=OPEN
router.get(
  "/",
  validate(getMyConversationsSchema, "query"),
  getMyConversations
);

// GET /api/support/:conversationId/messages?page=1&limit=50
router.get(
  "/:conversationId/messages",
  validate(getConversationMessagesParamsSchema, "params"),
  validate(getConversationMessagesQuerySchema, "query"),
  getConversationMessages
);

// POST /api/support/:conversationId/messages
router.post(
  "/:conversationId/messages",
  validate(sendMessageParamsSchema, "params"),
  validate(sendMessageBodySchema, "body"),
  sendMessage
);

// PATCH /api/support/:conversationId/reopen
router.patch(
  "/:conversationId/reopen",
  validate(reopenConversationSchema, "params"),
  reopenConversation
);

export default router;
