import Joi from "joi";

export const planParamSchema = Joi.object({
  plan: Joi.string().trim().uppercase().valid("FREE", "STARTER", "STANDARD", "PROFESSIONAL").required().messages({
    "string.empty": "Plan is required.",
    "any.only": "Plan must be FREE, STARTER, STANDARD, or PROFESSIONAL.",
    "any.required": "Plan is required.",
  }),
}).required();

export const resolvePricingSchema = Joi.object({
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
}).required();
