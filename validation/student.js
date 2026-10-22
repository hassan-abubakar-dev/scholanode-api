import Joi from "joi";

export const createStudentValidationSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  surName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  admissionNumber: Joi.string()
    .trim()
    .max(30)
    .required(),

  gender: Joi.string()
    .valid("MALE", "FEMALE")
    .required(),

  dateOfBirth: Joi.date()
    .iso()
    .max("now")
    .allow(null)
    .optional(),

  currentClassId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .allow(null)
    .optional(),

  enrollmentDate: Joi.date()
    .iso()
    .allow(null)
    .optional(),
});



export const getAllStudentsQueryValidationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),

  search: Joi.string()
    .trim()
    .max(100)
    .allow("")
    .default(""),

  currentClassId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .optional(),

  gender: Joi.string()
    .valid("MALE", "FEMALE")
    .optional(),

  admissionStatus: Joi.string()
    .valid("ACTIVE", "GRADUATED", "TRANSFERRED", "WITHDRAWN")
    .optional(),
}).unknown(false);


// Validation schema for each student record in a bulk import.
export const studentCsvRowSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  surName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  admissionNumber: Joi.string()
    .trim()
    .uppercase()
    .max(30)
    .required(),

  gender: Joi.string()
    .trim()
    .uppercase()
    .valid("MALE", "FEMALE")
    .required(),

  dateOfBirth: Joi.date()
    .iso()
    .max("now")
    .allow("", null)
    .optional(),

  // Human-readable class level, not a database UUID and required.
  classLevel: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .allow("", null)
    .required(),

  // Optional when the class has no arms or can be resolved unambiguously.
  arm: Joi.string()
    .trim()
    .max(30)
    .allow("", null)
    .optional(),

  enrollmentDate: Joi.date()
    .iso()
    .allow("", null)
    .optional(),
}).unknown(false);

// Validates the complete JSON request and every student record.
export const importStudentsSchema = Joi.object({
  students: Joi.array()
    .items(studentCsvRowSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      "array.base": "Student records must be provided as an array.",
      "array.min": "Please provide at least one student record.",
      "array.max":
        "You cannot import more than 1000 students at once.",
      "any.required": "Student records are required.",
    }),
})
  .required()
  .unknown(false);