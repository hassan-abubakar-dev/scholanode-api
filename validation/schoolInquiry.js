import Joi from "joi";

// Create a public school inquiry
export const createSchoolInquirySchema = Joi.object({
  schoolId: Joi.string().uuid().required().messages({
    "string.empty": "School ID is required.",
    "string.guid": "School ID must be a valid UUID.",
    "any.required": "School ID is required.",
  }),

  fullName: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Full name is required.",
    "string.min": "Full name must be at least 2 characters.",
    "string.max": "Full name cannot exceed 100 characters.",
  }),

  contact: Joi.string().trim().max(255).required().custom((value, helpers) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^\+?[\d\s()-]+$/;

    if (emailPattern.test(value)) {
      return value;
    }

    if (phonePattern.test(value)) {
      const digits = value.replace(/\D/g, "");

      if (digits.length >= 7 && digits.length <= 15) {
        return value;
      }
    }

    return helpers.error("any.invalid");
  }).messages({
    "string.empty": "Email address or phone number is required.",
    "string.max": "Contact cannot exceed 255 characters.",
    "any.invalid": "Please provide a valid email address or phone number.",
  }),

  subject: Joi.string().trim().min(3).max(150).required().messages({
    "string.empty": "Subject is required.",
    "string.min": "Subject must be at least 3 characters.",
    "string.max": "Subject cannot exceed 150 characters.",
  }),

  message: Joi.string().trim().min(10).max(2000).required().messages({
    "string.empty": "Message is required.",
    "string.min": "Message must be at least 10 characters.",
    "string.max": "Message cannot exceed 2000 characters.",
  }),
}).required();


// Get school inquiries: pagination, search, filtering, and sorting
export const getSchoolInquiriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number.",
    "number.integer": "Page must be an integer.",
    "number.min": "Page must be at least 1.",
  }),

  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": "Limit must be a number.",
    "number.integer": "Limit must be an integer.",
    "number.min": "Limit must be at least 1.",
    "number.max": "Limit cannot exceed 100.",
  }),

  search: Joi.string().trim().max(100).allow("").default("").messages({
    "string.max": "Search cannot exceed 100 characters.",
  }),

  status: Joi.string()
    .trim()
    .uppercase()
    .valid("NEW", "REVIEWED")
    .optional()
    .messages({
      "any.only": "Status must be NEW or REVIEWED.",
    }),

  sortBy: Joi.string()
    .trim()
    .valid("createdAt", "subject", "status", "fullName")
    .default("createdAt")
    .messages({
      "any.only": "Sort by must be createdAt, subject, status, or fullName.",
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


// Validate the inquiry ID in route parameters
export const schoolInquiryIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.empty": "Inquiry ID is required.",
    "string.guid": "Inquiry ID must be a valid UUID.",
    "any.required": "Inquiry ID is required.",
  }),
}).required();


// Update an inquiry's status
export const updateSchoolInquiryStatusSchema = Joi.object({
  status: Joi.string()
    .trim()
    .uppercase()
    .valid("NEW", "REVIEWED")
    .required()
    .messages({
      "string.empty": "Status is required.",
      "any.only": "Status must be NEW or REVIEWED.",
      "any.required": "Status is required.",
    }),
}).required();