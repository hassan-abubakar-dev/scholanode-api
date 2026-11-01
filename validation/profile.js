import Joi from "joi";


// ======================================================
// PROFILE IMAGE UPLOAD URL
// ======================================================

export const profileImageUploadUrlValidationSchema = Joi.object({
    fileName: Joi.string()
        .trim()
        .min(1)
        .max(255)
        .pattern(/^[a-zA-Z0-9 _.-]+$/)
        .required(),

    contentType: Joi.string()
        .valid("image/jpeg", "image/png", "image/webp")
        .required(),

    fileSize: Joi.number()
        .integer()
        .min(1)
        .max(5 * 1024 * 1024)
        .required(),
})
    .unknown(false);


// ======================================================
// CONFIRM PROFILE IMAGE UPLOAD
// ======================================================

export const confirmProfileImageUploadValidationSchema = Joi.object({
    key: Joi.string()
        .trim()
        .pattern(
            /^profiles\/users\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i
        )
        .required(),
})
    .unknown(false);

    
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