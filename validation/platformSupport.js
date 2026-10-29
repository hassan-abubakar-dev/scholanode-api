import Joi from "joi";

const uuid = Joi.string()
  .guid({ version: ["uuidv4", "uuidv5"] })
  .required();

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

const statuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const categories = [
  "TECHNICAL_ISSUE",
  "ACCOUNT_AND_ACCESS",
  "BILLING_AND_PAYMENT",
  "BUG_REPORT",
  "FEATURE_REQUEST",
  "GENERAL_INQUIRY",
  "OTHER",
];

export const conversationParamsSchema = Joi.object({
  conversationId: uuid,
}).unknown(false);

export const supportInboxQuerySchema = Joi.object({
  ...pagination,
  status: Joi.string().valid(...statuses),
  category: Joi.string().valid(...categories),
  isEscalated: Joi.boolean(),
  handlerId: Joi.string().guid({
    version: ["uuidv4", "uuidv5"],
  }),
  unassigned: Joi.boolean(),
  schoolId: Joi.string().guid({
    version: ["uuidv4", "uuidv5"],
  }),
  conversationId: Joi.string().guid({
    version: ["uuidv4", "uuidv5"],
  }),
}).unknown(false);

export const conversationMessagesQuerySchema = Joi.object({
  ...pagination,
}).unknown(false);

export const sendPlatformMessageBodySchema = Joi.object({
  message: Joi.string()
    .trim()
    .max(10000)
    .allow("", null)
    .default(null),

  imageUrl: Joi.string()
    .uri({ scheme: ["https"] })
    .max(2048)
    .allow(null)
    .default(null),

  imageKey: Joi.string()
    .trim()
    .max(500)
    .allow(null)
    .default(null),
})
  .custom((value, helpers) => {
    const hasMessage =
      typeof value.message === "string" &&
      value.message.trim().length > 0;

    const hasImageUrl =
      typeof value.imageUrl === "string" &&
      value.imageUrl.trim().length > 0;

    const hasImageKey =
      typeof value.imageKey === "string" &&
      value.imageKey.trim().length > 0;

    if (!hasMessage && !hasImageUrl) {
      return helpers.error("any.custom", {
        message: "Enter a message or attach an image.",
      });
    }

    if (hasImageUrl !== hasImageKey) {
      return helpers.error("any.custom", {
        message: "Image URL and image key must be supplied together.",
      });
    }

    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  })
  .unknown(false);

export const escalationBodySchema = Joi.object({
  reason: Joi.string().trim().min(5).max(2000).required(),
}).unknown(false);