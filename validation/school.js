import Joi from "joi";

export const registerSchoolValidationSchema = Joi.object({
  school: Joi.object({
    schoolName: Joi.string().trim().min(3).max(150).required().messages({
      "string.empty": "School name is required.",
      "string.min": "School name must be at least 3 characters.",
      "string.max": "School name cannot exceed 150 characters.",
    }),

    schoolCode: Joi.string().trim().uppercase().min(3).max(20).required().messages({
      "string.empty": "School code is required.",
      "string.min": "School code must be at least 3 characters.",
      "string.max": "School code cannot exceed 20 characters.",
    }),

    address: Joi.string().trim().min(5).max(500).required().messages({
      "string.empty": "School address is required.",
      "string.min": "School address must be at least 5 characters.",
      "string.max": "School address cannot exceed 500 characters.",
    }),

    schoolLevel: Joi.string().trim().uppercase().valid("PRIMARY", "SECONDARY", "COMBINED").required().messages({
      "string.empty": "School level is required.",
      "any.only": "School level must be PRIMARY, SECONDARY, or COMBINED.",
    }),

    ownershipType: Joi.string().trim().uppercase().valid("GOVERNMENT", "PRIVATE").required().messages({
      "string.empty": "Ownership type is required.",
      "any.only": "Ownership type must be GOVERNMENT or PRIVATE.",
    }),
  }).required(),

  admin: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required().messages({
      "string.empty": "Admin first name is required.",
      "string.min": "Admin first name must be at least 2 characters.",
    }),

    surName: Joi.string().trim().min(2).max(50).required().messages({
      "string.empty": "Admin surname is required.",
      "string.min": "Admin surname must be at least 2 characters.",
    }),

    email: Joi.string().trim().email().required().messages({
      "string.empty": "Admin email is required.",
      "string.email": "Please provide a valid email address.",
    }),

    password: Joi.string().trim().min(8).max(128).required().messages({
      "string.empty": "Password is required.",
      "string.min": "Password must be at least 8 characters.",
    }),

    role: Joi.string().trim().uppercase().valid("LEADER", "VICE_LEADER", "ADMINISTRATOR", "EXAM_OFFICER", "STAFF").required().messages({
      "string.empty": "Admin role is required.",
      "any.only": "Role is invalid.",
    }),
  }).required(),

  plan: Joi.object({
    plan: Joi.string().trim().uppercase().valid("FREE", "STARTER", "STANDARD", "PROFESSIONAL").required().messages({
      "string.empty": "Plan is required.",
      "any.only": "Plan must be FREE, STARTER, STANDARD, or PROFESSIONAL.",
    }),

    tierId: Joi.when("plan", {
      is: "FREE",
      then: Joi.forbidden(),
      otherwise: Joi.string().trim().required(),
    }),

    billingCycle: Joi.when("plan", {
      is: "FREE",
      then: Joi.forbidden(),
      otherwise: Joi.string()
        .trim()
        .uppercase()
        .valid("MONTHLY", "TERMLY", "YEARLY")
        .required()
        .messages({
          "any.only": "Billing cycle must be MONTHLY, TERMLY, or YEARLY.",
        }),
    }),
  }).required(),
}).required();

export const schoolCodeQuerySchema = Joi.object({
  schoolCode: Joi.string().trim().required().messages({
    "string.empty": "schoolCode is required.",
  }),
}).required();

export const schoolCodeParamSchema = Joi.object({
  code: Joi.string().trim().min(3).max(20).required().messages({
    "string.empty": "School code is required.",
    "string.min": "School code must be at least 3 characters.",
    "string.max": "School code cannot exceed 20 characters.",
  }),
}).required();

export const updateSchoolSetupSchema = Joi.object({
  welcomeMessage: Joi.string().trim().max(2000).allow(null, "").optional(),
  supportEmail: Joi.string().trim().email().max(100).allow(null, "").optional(),
  supportPhone: Joi.string().trim().max(20).allow(null, "").optional(),
}).or("welcomeMessage", "supportEmail", "supportPhone").required();

// ======================================================
// SCHOOL LOGO UPLOAD URL
// ======================================================

export const schoolLogoUploadUrlValidationSchema = Joi.object({
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
}).unknown(false);

// ======================================================
// CONFIRM SCHOOL LOGO UPLOAD
// ======================================================

export const confirmSchoolLogoUploadValidationSchema = Joi.object({
  key: Joi.string()
    .trim()
    .pattern(
      /^schools\/[0-9a-f-]{36}\/logo\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i
    )
    .required(),
}).unknown(false);

export const academicSetupValidationSchema = Joi.object({
  session: Joi.object({
    sessionName: Joi.string().trim().min(4).max(20).required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  }).required(),

  terms: Joi.array()
    .items(
      Joi.object({
        termName: Joi.string()
          .trim()
          .uppercase()
          .valid("FIRST_TERM", "SECOND_TERM", "THIRD_TERM")
          .required(),
        startDate: Joi.date().required(),
        endDate: Joi.date().greater(Joi.ref("startDate")).required(),
      })
    )
    .length(3)
    .unique("termName")
    .required(),
}).required();

export const classSetupValidationSchema = Joi.object({
  classes: Joi.array().items(
    Joi.object({
      classLevel: Joi.string().trim().min(1).max(20).required(),
      arm: Joi.string().trim().min(1).max(50).allow(null, "").optional(),
    })
  ).min(1).required(),
}).required();

export const subjectSetupValidationSchema = Joi.object({
  subjects: Joi.array().items(
    Joi.object({
      subjectName: Joi.string().trim().min(1).max(100).required(),
    })
  ).min(1).required(),
}).required();
