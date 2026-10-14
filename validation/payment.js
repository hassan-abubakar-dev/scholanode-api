import Joi from "joi";

export const initializePaymentParamSchema = Joi.object({
  schoolId: Joi.string().uuid().required().messages({
    "string.guid": "School ID must be a valid UUID.",
    "any.required": "School ID is required.",
  }),
}).required();

export const initializePaymentBodySchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please provide a valid email address.",
    "any.required": "Email is required.",
  }),

  plan: Joi.string().trim().uppercase().valid("FREE", "STARTER", "STANDARD", "PROFESSIONAL").required().messages({
    "string.empty": "Plan is required.",
    "any.only": "Plan must be FREE, STARTER, STANDARD, or PROFESSIONAL.",
    "any.required": "Plan is required.",
  }),

  tierId: Joi.alternatives()
    .try(Joi.string().trim(), Joi.number().integer())
    .required()
    .messages({
      "any.required": "Tier ID is required.",
    }),

  billingCycle: Joi.string().trim().uppercase().valid("MONTHLY", "TERMLY", "YEARLY").required().messages({
    "string.empty": "Billing cycle is required.",
    "any.only": "Billing cycle must be MONTHLY, TERMLY, or YEARLY.",
    "any.required": "Billing cycle is required.",
  }),

  metadata: Joi.object().unknown(true).optional(),
}).required();

export const paymentStatusParamSchema = Joi.object({
  reference: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Payment reference is required.",
    "string.min": "Payment reference must be at least 3 characters.",
    "string.max": "Payment reference cannot exceed 100 characters.",
    "any.required": "Payment reference is required.",
  }),
}).required();
