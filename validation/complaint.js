import Joi from "joi";

// ==========================================
// CONSTANTS
// ==========================================

const complaintCategories = [
  "ACADEMIC",
  "STAFF_CONDUCT",
  "STUDENT_WELFARE",
  "FEES_AND_PAYMENTS",
  "FACILITIES",
  "ATTENDANCE",
  "GENERAL",
];

const complaintStatuses = [
  "SUBMITTED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

// ==========================================
// CREATE COMPLAINT
// ==========================================

export const createComplaintSchema = Joi.object({
  category: Joi.string()
    .valid(...complaintCategories)
    .required(),

  subject: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .required(),

  description: Joi.string()
    .trim()
    .min(10)
    .max(5000)
    .required(),

  isAnonymous: Joi.boolean()
    .default(false),
}).required();

// ==========================================
// GET MY COMPLAINTS
// ==========================================

export const myComplaintsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...complaintStatuses)
    .optional(),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),
}).unknown(false);

// ==========================================
// GET SCHOOL COMPLAINTS
// ==========================================

export const schoolComplaintsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...complaintStatuses)
    .optional(),

  category: Joi.string()
    .valid(...complaintCategories)
    .optional(),

  startDate: Joi.date()
    .iso()
    .optional(),

  endDate: Joi.date()
    .iso()
    .optional(),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),
})
  .unknown(false)
  .custom((value, helpers) => {
    if (
      value.startDate &&
      value.endDate &&
      new Date(value.startDate) > new Date(value.endDate)
    ) {
      return helpers.error("date.range");
    }

    return value;
  })
  .messages({
    "date.range":
      '"startDate" must be earlier than or equal to "endDate"',
  });

// ==========================================
// UPDATE COMPLAINT STATUS
// ==========================================

export const updateComplaintStatusSchema = Joi.object({
  status: Joi.string()
    .valid("IN_PROGRESS", "RESOLVED", "CLOSED")
    .required(),

  resolutionNote: Joi.string()
    .trim()
    .max(2000)
    .allow("")
    .optional(),
})
  .unknown(false)
  .required();

// ==========================================
// COMPLAINT ID PARAMETER
// ==========================================

export const complaintIdParamSchema = Joi.object({
  complaintId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required(),
}).required();