import Joi from "joi";


// ========================================
// 1. Create a public Contact ScholaNode inquiry
// ========================================

export const createContactInquirySchema = Joi.object({
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Full name is required.",
      "string.min": "Full name must be at least 2 characters.",
      "string.max": "Full name cannot exceed 100 characters.",
      "any.required": "Full name is required.",
    }),

  email: Joi.string()
    .trim()
    .email()
    .max(255)
    .required()
    .messages({
      "string.empty": "Email address is required.",
      "string.email": "Please provide a valid email address.",
      "string.max": "Email address cannot exceed 255 characters.",
      "any.required": "Email address is required.",
    }),

  category: Joi.string()
    .valid(
      "SCHOOL_REGISTRATION",
      "ACCOUNT_ACTIVATION",
      "SUBSCRIPTION_AND_BILLING",
      "TECHNICAL_SUPPORT",
      "PARTNERSHIP",
      "GENERAL_INQUIRY",
      "OTHER"
    )
    .required()
    .messages({
      "any.only": "Please select a valid inquiry category.",
      "any.required": "Inquiry category is required.",
    }),

  subject: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .required()
    .messages({
      "string.empty": "Subject is required.",
      "string.min": "Subject must be at least 3 characters.",
      "string.max": "Subject cannot exceed 150 characters.",
      "any.required": "Subject is required.",
    }),

  message: Joi.string()
    .trim()
    .min(10)
    .max(2000)
    .required()
    .messages({
      "string.empty": "Message is required.",
      "string.min": "Message must be at least 10 characters.",
      "string.max": "Message cannot exceed 2000 characters.",
      "any.required": "Message is required.",
    }),

  allowEmailReply: Joi.boolean()
    .required()
    .messages({
      "boolean.base": "Email reply permission must be true or false.",
      "any.required": "Please specify whether email replies are allowed.",
    }),
}).required();


// ========================================
// 2. Get inquiries: filtering and pagination
// ========================================

export const getContactInquiriesQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      "number.base": "Page must be a number.",
      "number.integer": "Page must be an integer.",
      "number.min": "Page must be at least 1.",
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      "number.base": "Limit must be a number.",
      "number.integer": "Limit must be an integer.",
      "number.min": "Limit must be at least 1.",
      "number.max": "Limit cannot exceed 100.",
    }),

  search: Joi.string()
    .trim()
    .max(100)
    .allow("")
    .default("")
    .messages({
      "string.max": "Search cannot exceed 100 characters.",
    }),

  status: Joi.string()
    .trim()
    .uppercase()
    .valid("NEW", "REVIEWED", "REPLIED", "CLOSED")
    .optional()
    .messages({
      "any.only": "Status must be NEW, REVIEWED, REPLIED, or CLOSED.",
    }),

  category: Joi.string()
    .valid(
      "SCHOOL_REGISTRATION",
      "ACCOUNT_ACTIVATION",
      "SUBSCRIPTION_AND_BILLING",
      "TECHNICAL_SUPPORT",
      "PARTNERSHIP",
      "GENERAL_INQUIRY",
      "OTHER"
    )
    .optional()
    .messages({
      "any.only": "Please select a valid inquiry category.",
    }),

  sortBy: Joi.string()
    .valid("createdAt", "subject", "status", "fullName", "category")
    .default("createdAt")
    .messages({
      "any.only":
        "Sort by must be createdAt, subject, status, fullName, or category.",
    }),

  sortOrder: Joi.string()
    .trim()
    .uppercase()
    .valid("ASC", "DESC")
    .default("DESC")
    .messages({
      "any.only": "Sort order must be ASC or DESC.",
    }),
}).required();


// ========================================
// 3. Validate the inquiry ID in route parameters
// ========================================

export const contactInquiryIdParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.empty": "Inquiry ID is required.",
      "string.guid": "Inquiry ID must be a valid UUID.",
      "any.required": "Inquiry ID is required.",
    }),
}).required();


// ========================================
// 4. Update an inquiry's status
// ========================================

export const updateContactInquiryStatusSchema = Joi.object({
  status: Joi.string()
    .trim()
    .uppercase()
    .valid("NEW", "REVIEWED", "REPLIED", "CLOSED")
    .required()
    .messages({
      "string.empty": "Status is required.",
      "any.only": "Status must be NEW, REVIEWED, REPLIED, or CLOSED.",
      "any.required": "Status is required.",
    }),
}).required();