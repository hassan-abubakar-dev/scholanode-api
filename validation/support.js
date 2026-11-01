import Joi from "joi";

// ==========================================
// ENUMS
// Keep these synchronized with the model enums.
// ==========================================

const conversationCategories = [
  "TECHNICAL_ISSUE",
  "ACCOUNT_AND_ACCESS",
  "BILLING_AND_PAYMENT",
  "BUG_REPORT",
  "FEATURE_REQUEST",
  "GENERAL_INQUIRY",
  "OTHER",
];

const conversationStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

// ==========================================
// SHARED SCHEMAS
// ==========================================

const conversationIdParamsSchema = Joi.object({
  conversationId: Joi.string()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .required(),
})
  .unknown(false)
  .required();

const messageSchema = Joi.object({
  message: Joi.string()
    .trim()
    .min(1)
    .max(10000)
    .required(),
})
  .unknown(false)
  .required();

// ==========================================
// CREATE CONVERSATION
// ==========================================

export const createConversationSchema = Joi.object({
  category: Joi.string()
    .valid(...conversationCategories)
    .required(),

  message: Joi.string()
    .trim()
    .min(1)
    .max(10000)
    .required(),
})
  .unknown(false)
  .required();

// ==========================================
// GET MY CONVERSATIONS
// ==========================================

export const getMyConversationsSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),

  status: Joi.string()
    .valid(...conversationStatuses)
    .optional(),

  category: Joi.string()
    .valid(...conversationCategories)
    .optional(),
})
  .unknown(false)
  .required();

// ==========================================
// GET CONVERSATION MESSAGES
// ==========================================

export const getConversationMessagesParamsSchema =
  conversationIdParamsSchema;

export const getConversationMessagesQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50),
})
  .unknown(false)
  .required();

// ==========================================
// SEND MESSAGE
// ==========================================

export const sendMessageParamsSchema =
  conversationIdParamsSchema;

export const sendMessageBodySchema = messageSchema;

// ==========================================
// REOPEN CONVERSATION
// ==========================================

export const reopenConversationSchema =
  conversationIdParamsSchema;