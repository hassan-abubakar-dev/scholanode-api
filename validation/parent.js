import Joi from "joi";

const parentStudentSchema = Joi.object({
  studentId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Student ID must be a valid UUID.",
      "any.required":
        "Student ID is required when linking a student.",
    }),

  relationship: Joi.string()
    .trim()
    .uppercase()
    .valid("FATHER", "MOTHER", "GUARDIAN", "OTHER")
    .required()
    .messages({
      "any.only": "Parent-student relationship is invalid.",
      "any.required": "Relationship type is required.",
    }),
})
  .required()
  .unknown(false);

export const createParentSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Parent's first name is required.",
      "any.required": "Parent's first name is required.",
    }),

  surName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Parent's surname is required.",
      "any.required": "Parent's surname is required.",
    }),

  phoneNumber: Joi.string()
    .trim()
    .min(7)
    .max(20)
    .required()
    .messages({
      "string.empty": "Parent's phone number is required.",
      "any.required": "Parent's phone number is required.",
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .max(100)
    .required()
    .messages({
      "string.empty": "Parent's email address is required.",
      "string.email": "Please provide a valid email address.",
      "any.required": "Parent's email address is required.",
    }),

  // Omit student to create a parent without linking a student.
  student: parentStudentSchema.optional(),
})
  .required()
  .unknown(false);

 

export const getAllParentsSchema = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),

  status: Joi.string()
    .uppercase()
    .valid("ALL", "ACTIVE", "INACTIVE", "SUSPENDED")
    .default("ALL"),

  relationship: Joi.string()
    .uppercase()
    .valid("ALL", "FATHER", "MOTHER", "GUARDIAN", "OTHER")
    .default("ALL"),

  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false);


export const linkParentToStudentSchema = Joi.object({
  parentId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Parent ID must be a valid UUID.",
      "any.required": "Parent ID is required.",
    }),

  studentId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Student ID must be a valid UUID.",
      "any.required": "Student ID is required.",
    }),

  relationship: Joi.string()
    .trim()
    .uppercase()
    .valid("FATHER", "MOTHER", "GUARDIAN", "OTHER")
    .required()
    .messages({
      "any.only": "Parent-student relationship is invalid.",
      "any.required": "Relationship type is required.",
    }),
})
  .required()
  .unknown(false);


  export const unlinkParentFromStudentSchema = Joi.object({
  parentId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Parent ID must be a valid UUID.",
      "any.required": "Parent ID is required.",
    }),

  studentId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Student ID must be a valid UUID.",
      "any.required": "Student ID is required.",
    }),
})
  .required()
  .unknown(false);


  export const deleteParentSchema = Joi.object({
  parentId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Parent ID must be a valid UUID.",
      "any.required": "Parent ID is required.",
    }),
})
  .required()
  .unknown(false);


  // Validation schema for each parent record in bulk import.
export const parentCsvRowSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Parent's first name is required.",
      "any.required": "Parent's first name is required.",
    }),

  surName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Parent's surname is required.",
      "any.required": "Parent's surname is required.",
    }),

  phoneNumber: Joi.string()
    .trim()
    .min(7)
    .max(20)
    .required()
    .messages({
      "string.empty": "Parent's phone number is required.",
      "any.required": "Parent's phone number is required.",
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .max(100)
    .required()
    .messages({
      "string.empty": "Parent's email address is required.",
      "string.email": "Please provide a valid email address.",
      "any.required": "Parent's email address is required.",
    }),
}).unknown(false);

// Validates the complete JSON request and every parent record.
export const importParentsSchema = Joi.object({
  parents: Joi.array()
    .items(parentCsvRowSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      "array.base": "Parent records must be provided as an array.",
      "array.min": "Please provide at least one parent record.",
      "array.max":
        "You cannot import more than 1000 parents at once.",
      "any.required": "Parent records are required.",
    }),
})
  .required()
  .unknown(false);

  export const childEmailChangeParamsSchema = Joi.object({
  studentId: Joi.string().uuid().required(),
}).unknown(false);

export const requestChildEmailChangeSchema = Joi.object({
  newEmail: Joi.string().trim().email().max(100).required(),
  currentPassword: Joi.string().min(1).required(),
}).unknown(false);

export const verifyChildEmailChangeSchema = Joi.object({
  newEmail: Joi.string().trim().email().max(100).required(),
  code: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.pattern.base": "Verification code must contain exactly 6 digits.",
    }),
}).unknown(false);