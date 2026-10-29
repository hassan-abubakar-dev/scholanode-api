import { Router } from "express";

import {
  getSupportInbox,
  getConversationMessages,
  claimConversation,
  releaseConversation,
  sendConversationMessage,
  resolveConversation,
  closeConversation,
  escalateConversation,
  getEscalatedConversations,
  takeOverConversation,
  returnEscalatedConversation,
  reopenConversation,
} from "../controllers/platformSupport.js";

import {
  conversationParamsSchema,
  supportInboxQuerySchema,
  conversationMessagesQuerySchema,
  sendPlatformMessageBodySchema,
  escalationBodySchema,
} from "../validation/platformSupport.js";

// import protectPlatformRoutes from "../middlewares/protectPlatformRoutes.js";
import  validate  from "../middleware/validation.js";

const router = Router();
 
// All routes require platform authentication.
// router.use(protectPlatformRoutes);

// ------------------------------------------------------------
// Inbox and conversation messages
// ------------------------------------------------------------

router.get(
  "/",
  validate(supportInboxQuerySchema, "query"),
  getSupportInbox
);

router.get(
  "/escalated",
  validate(supportInboxQuerySchema, "query"),
  getEscalatedConversations
);

router.get(
  "/:conversationId/messages",
  validate(conversationParamsSchema, "params"),
  validate(conversationMessagesQuerySchema, "query"),
  getConversationMessages
);

// ------------------------------------------------------------
// Conversation handling
// ------------------------------------------------------------

router.post(
  "/:conversationId/claim",
  validate(conversationParamsSchema, "params"),
  claimConversation
);

router.post(
  "/:conversationId/release",
  validate(conversationParamsSchema, "params"),
  releaseConversation
);

router.post(
  "/:conversationId/messages",
  validate(conversationParamsSchema, "params"),
  validate(sendPlatformMessageBodySchema, "body"),
  sendConversationMessage
);

router.patch(
  "/:conversationId/resolve",
  validate(conversationParamsSchema, "params"),
  resolveConversation
);

router.patch(
  "/:conversationId/close",
  validate(conversationParamsSchema, "params"),
  closeConversation
);

router.post(
  "/:conversationId/escalate",
  validate(conversationParamsSchema, "params"),
  validate(escalationBodySchema, "body"),
  escalateConversation
);

router.patch(
  "/:conversationId/reopen",
  validate(conversationParamsSchema, "params"),
  reopenConversation
);

// ------------------------------------------------------------
// Platform-admin escalation management
// ------------------------------------------------------------

router.post(
  "/:conversationId/take-over",
  validate(conversationParamsSchema, "params"),
  takeOverConversation
);

router.post(
  "/:conversationId/return-to-queue",
  validate(conversationParamsSchema, "params"),
  returnEscalatedConversation
);

export default router;