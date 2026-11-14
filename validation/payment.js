import Joi from "joi";

export const initializePaymentParamSchema = Joi.object({
  schoolId: Joi.string().uuid().required().messages({
    "string.guid": "School ID must be a valid UUID.",
    "any.required": "School ID is required.",
  }),
}).required();

export const initializePaymentBodySchema = Joi.object({
  plan: Joi.string()
    .trim()
    .uppercase()
    .valid("STARTER", "STANDARD", "PROFESSIONAL")
    .required()
    .messages({
      "string.empty": "Plan is required.",
      "any.only": "Plan must be STARTER, STANDARD, or PROFESSIONAL.",
      "any.required": "Plan is required.",
    }),

  tierId: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Tier ID is required.",
      "any.required": "Tier ID is required.",
    }),

  billingCycle: Joi.string()
    .trim()
    .uppercase()
    .valid("MONTHLY", "TERMLY", "YEARLY")
    .required()
    .messages({
      "string.empty": "Billing cycle is required.",
      "any.only": "Billing cycle must be MONTHLY, TERMLY, or YEARLY.",
      "any.required": "Billing cycle is required.",
    }),
}).required();

export const paymentStatusParamSchema = Joi.object({
  reference: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Payment reference is required.",
    "string.min": "Payment reference must be at least 3 characters.",
    "string.max": "Payment reference cannot exceed 100 characters.",
    "any.required": "Payment reference is required.",
  }),
}).required();


export const paymentHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(50).default(10),

  status: Joi.string()
    .trim()
    .uppercase()
    .valid(
      "PENDING",
      "PROCESSING",
      "SUCCESSFUL",
      "FAILED",
      "CANCELLED"
    )
    .optional(),
}).required();

export const paymentReceiptParamSchema = Joi.object({
  paymentId: Joi.string().uuid().required().messages({
    "string.guid": "Payment ID must be a valid UUID.",
    "any.required": "Payment ID is required.",
  }),
}).required();