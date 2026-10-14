import Joi from "joi";

export const verifyAccountValidationSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email address is required.",
    "string.email": "Please provide a valid email address.",
    "any.required": "Email address is required.",
  }),

  code: Joi.string().trim().length(6).required().messages({
    "string.empty": "Verification code is required.",
    "string.length": "Verification code must be exactly 6 characters.",
    "any.required": "Verification code is required.",
  }),
}).required();

export const verifyRecoveryCodeValidationSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email address is required.",
    "string.email": "Please provide a valid email address.",
    "any.required": "Email address is required.",
  }),

  verificationCode: Joi.string().trim().length(6).required().messages({
    "string.empty": "Verification code is required.",
    "string.length": "Verification code must be exactly 6 characters.",
    "any.required": "Verification code is required.",
  }),
}).required();
