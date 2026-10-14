import Joi from "joi";

export const updateStaffSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  surName: Joi.string().trim().min(2).max(50),

  email: Joi.string()
    .email()
    .max(100)
    .allow("", null),

  phoneNumber: Joi.string()
    .trim()
    .max(20)
    .allow("", null),

  role: Joi.string().valid(
    "VICE_LEADER",
    "ADMINISTRATOR",
    "EXAM_OFFICER",
    "STAFF"
  ),
})
  .min(1)
  .messages({
    "object.min": "Provide at least one field to update.",
    "object.unknown": "One or more fields are not allowed.",
  });


export const inviteStaffValidationSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required()
    .messages({
      "string.empty": "Staff email is required.",
      "string.email": "Please provide a valid email address.",
      "any.required": "Staff email is required.",
    }),

  role: Joi.string()
    .trim()
    .uppercase()
    .valid(
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
      "EXAM_OFFICER",
      "STAFF"
    )
    .required()
    .messages({
      "string.empty": "Staff role is required.",
      "any.only": "Role is invalid.",
      "any.required": "Staff role is required.",
    }),
}).required();




// Validation schema for each staff record in the CSV import.
export const staffCsvRowSchema = Joi.object({
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

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .max(100)
    .required(),

  role: Joi.string()
    .trim()
    .uppercase()
    .valid(
      "STAFF",
      "EXAM_OFFICER",
      "VICE_LEADER",
      "ADMINISTRATOR"
    )
    .required(),
})
  .unknown(false);

// Validates the complete JSON request and each staff record.
export const importStaffCsvSchema = Joi.object({
  staff: Joi.array()
    .items(staffCsvRowSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      "array.base": "Staff records must be provided as an array.",
      "array.min": "Please provide at least one staff record.",
      "array.max":
        "You cannot import more than 1000 staff members at once.",
      "any.required": "Staff records are required.",
    }),
})
  .required()
  .unknown(false);
