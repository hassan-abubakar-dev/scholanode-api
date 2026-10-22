
import Joi from "joi";

export const createSecurityPersonnelSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "First name is required.",
      "any.required": "First name is required.",
    }),

  surName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Surname is required.",
      "any.required": "Surname is required.",
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .max(100)
    .required()
    .messages({
      "string.empty": "Email address is required.",
      "string.email": "Please provide a valid email address.",
      "any.required": "Email address is required.",
    }),
})
  .required()
  .unknown(false);


export const updateSecurityPersonnelSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50),

  surName: Joi.string()
    .trim()
    .min(2)
    .max(50),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .max(100),
})
  .min(1)
  .required()
  .unknown(false)
  .messages({
    "object.min": "Provide at least one field to update.",
    "object.unknown": "One or more fields are not allowed.",
  });
