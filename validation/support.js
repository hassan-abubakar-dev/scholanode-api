
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
  conversationId: Joi.string().guid({
    version: ["uuidv4", "uuidv5"],
  }).required(),
}).unknown(false);

const messageFields = {
  message: Joi.string()
    .trim()
    .max(10000)
    .allow("")
    .optional(),

  imageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow("")
    .optional(),

  imageKey: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .optional(),
};

const requireMessageOrImage = (value, helpers) => {
  const hasMessage =
    typeof value.message === "string" &&
    value.message.trim().length > 0;

  const hasImage =
    typeof value.imageUrl === "string" &&
    value.imageUrl.trim().length > 0;

  if (!hasMessage && !hasImage) {
    return helpers.error("any.custom");
  }

  const hasImageUrl = Boolean(value.imageUrl?.trim());
  const hasImageKey = Boolean(value.imageKey?.trim());

  if (hasImageUrl !== hasImageKey) {
    return helpers.error("any.customImage");
  }

  return value;
};

const contentMessages = {
  "any.custom": "A message or image attachment is required.",
  "any.customImage":
    "A valid image attachment must include both imageUrl and imageKey.",
};

// ==========================================
// CREATE CONVERSATION
// ==========================================

export const createConversationSchema = Joi.object({
  category: Joi.string()
    .valid(...conversationCategories)
    .required(),

  ...messageFields,
})
  .custom(requireMessageOrImage)
  .messages({
    ...contentMessages,
    "any.required": "{{#label}} is required.",
  })
  .unknown(false);

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
}).unknown(false);

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
}).unknown(false);

// ==========================================
// SEND MESSAGE
// ==========================================

export const sendMessageParamsSchema =
  conversationIdParamsSchema;

export const sendMessageBodySchema = Joi.object({
  ...messageFields,
})
  .custom(requireMessageOrImage)
  .messages(contentMessages)
  .unknown(false);

// ==========================================
// REOPEN CONVERSATION
// ==========================================

export const reopenConversationSchema =
  conversationIdParamsSchema;
