import Joi from "joi";

export const updateProfileValidationSchema = Joi.object({
    firstName: Joi.string()
        .trim()
        .min(1)
        .max(50),

    surName: Joi.string()
        .trim()
        .min(1)
        .max(50),
})
    .min(1)
    .unknown(false);

export const requestEmailChangeValidationSchema = Joi.object({
    newEmail: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(100)
        .required(),

    currentPassword: Joi.string()
        .min(1)
        .max(128)
        .required(),
})
    .unknown(false);

export const verifyEmailChangeValidationSchema = Joi.object({
    newEmail: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(100)
        .required(),

    code: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            "string.pattern.base":
                "Verification code must contain exactly 6 digits.",
        }),
})
    .unknown(false);