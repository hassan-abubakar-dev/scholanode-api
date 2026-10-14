import Joi from "joi";

export const loginValidationSchema = Joi.object({
  schoolCode: Joi.string().trim().uppercase().min(3).max(20).required().messages({
    "string.empty": "School code is required.",
    "string.min": "School code must be at least 3 characters.",
    "string.max": "School code cannot exceed 20 characters.",
    "any.required": "School code is required.",
  }),

  loginId: Joi.string().trim().uppercase().required().messages({
    "string.empty": "Login ID is required.",
    "any.required": "Login ID is required.",
  }),

  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
}).required();

export const forgotLoginIdValidationSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email address is required.",
    "string.email": "Please provide a valid email address.",
    "any.required": "Email address is required.",
  }),
}).required();

export const forgotPasswordValidationSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email address is required.",
    "string.email": "Please provide a valid email address.",
    "any.required": "Email address is required.",
  }),
}).required();

export const resetPasswordValidationSchema = Joi.object({
  password: Joi.string().min(8).max(128).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 8 characters.",
    "string.max": "Password cannot exceed 128 characters.",
    "any.required": "Password is required.",
  }),

  token: Joi.string().trim().required().messages({
    "string.empty": "Reset token is required.",
    "any.required": "Reset token is required.",
  }),
}).required();
