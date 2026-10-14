import Joi from "joi";

export const registerTeacherValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 2 characters.",
    "string.max": "First name cannot exceed 50 characters.",
    "any.required": "First name is required.",
  }),

  surName: Joi.string().trim().min(2).max(50).optional().messages({
    "string.min": "Surname must be at least 2 characters.",
    "string.max": "Surname cannot exceed 50 characters.",
  }),

  lastName: Joi.string().trim().min(2).max(50).optional().messages({
    "string.min": "Last name must be at least 2 characters.",
    "string.max": "Last name cannot exceed 50 characters.",
  }),

  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please provide a valid email address.",
    "any.required": "Email is required.",
  }),

  password: Joi.string().trim().min(8).max(128).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 8 characters.",
    "string.max": "Password cannot exceed 128 characters.",
    "any.required": "Password is required.",
  }),

  phoneNumber: Joi.string().trim().max(20).allow(null, "").optional(),

  role: Joi.string()
    .trim()
    .uppercase()
    .valid("LEADER", "VICE", "ADMINISTRATOR", "EXAM_OFFICER", "BURSAR")
    .default("ADMINISTRATOR")
    .messages({
      "any.only": "Role must be LEADER, VICE, ADMINISTRATOR, EXAM_OFFICER, or BURSAR.",
    }),
})
  .or("surName", "lastName")
  .required()
  .messages({
    "object.missing": "Either surname or lastName is required.",
  });

export const registerStudentValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 2 characters.",
    "string.max": "First name cannot exceed 50 characters.",
    "any.required": "First name is required.",
  }),

  surName: Joi.string().trim().min(2).max(50).optional().messages({
    "string.min": "Surname must be at least 2 characters.",
    "string.max": "Surname cannot exceed 50 characters.",
  }),

  lastName: Joi.string().trim().min(2).max(50).optional().messages({
    "string.min": "Last name must be at least 2 characters.",
    "string.max": "Last name cannot exceed 50 characters.",
  }),

  email: Joi.string().trim().lowercase().email().allow(null, "").optional().messages({
    "string.email": "Please provide a valid email address.",
  }),

  password: Joi.string().trim().min(8).max(128).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 8 characters.",
    "string.max": "Password cannot exceed 128 characters.",
    "any.required": "Password is required.",
  }),

  phoneNumber: Joi.string().trim().max(20).allow(null, "").optional(),

  admissionNumber: Joi.string().trim().min(1).max(30).required().messages({
    "string.empty": "Admission number is required.",
    "string.max": "Admission number cannot exceed 30 characters.",
    "any.required": "Admission number is required.",
  }),

  gender: Joi.string().trim().uppercase().valid("MALE", "FEMALE").required().messages({
    "string.empty": "Gender is required.",
    "any.only": "Gender must be either MALE or FEMALE.",
    "any.required": "Gender is required.",
  }),

  dateOfBirth: Joi.date().iso().allow(null).optional(),

  currentClassId: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "currentClassId must be a valid UUID.",
  }),

  enrollmentDate: Joi.date().iso().required().messages({
    "date.base": "Enrollment date must be a valid date.",
    "any.required": "Enrollment date is required.",
  }),
})
  .or("surName", "lastName")
  .required()
  .messages({
    "object.missing": "Either surname or lastName is required.",
  });
