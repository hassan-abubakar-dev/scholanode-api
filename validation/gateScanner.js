
import Joi from "joi";

export const verifyStudentSchema = Joi.object({
  method: Joi.string()
    .valid("QR", "ADMISSION_NUMBER")
    .required()
    .messages({
      "any.only": "Method must be QR or ADMISSION_NUMBER.",
      "any.required": "Verification method is required.",
    }),

  value: Joi.when("method", {
    is: "QR",
    then: Joi.string()
      .guid()
      .required()
      .messages({
        "string.guid": "QR data must contain a valid UUID token.",
        "any.required": "QR token is required.",
      }),

    otherwise: Joi.string()
      .trim()
      .min(1)
      .max(30)
      .required()
      .messages({
        "string.empty": "Admission number is required.",
        "string.max": "Admission number cannot exceed 30 characters.",
        "any.required": "Admission number is required.",
      }),
  }),

  scanType: Joi.string()
    .valid("ARRIVAL", "RETURN")
    .required()
    .messages({
      "any.only": "Scan type must be ARRIVAL or RETURN.",
      "any.required": "Please select Arrival or Return.",
    }),
})
  .required()
  .unknown(false);

  
export const recordStudentScanSchema = Joi.object({
  studentIds: Joi.array()
    .items(Joi.string().guid().required())
    .min(1)
    .unique()
    .required()
    .messages({
      "array.base": "Selected students must be provided as a list.",
      "array.min": "Select at least one student to record.",
      "array.unique": "A student cannot be selected more than once.",
      "any.required": "Select at least one student to record.",
    }),

  scanType: Joi.string()
    .valid("ARRIVAL", "RETURN")
    .required()
    .messages({
      "any.only": "Scan type must be ARRIVAL or RETURN.",
      "any.required": "Please select Arrival or Return.",
    }),
})
  .required()
  .unknown(false);

  // Grant scanner permission to a staff member.
export const authorizeStaffScannerSchema = Joi.object({
  userId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Staff user ID must be a valid UUID.",
      "any.required": "Select a staff member to authorize.",
    }),
})
  .required()
  .unknown(false);


// Validate the staff user ID in the revoke route.
export const revokeStaffScannerParamsSchema = Joi.object({
  userId: Joi.string()
    .guid()
    .required()
    .messages({
      "string.guid": "Staff user ID must be a valid UUID.",
      "any.required": "Staff user ID is required.",
    }),
})
  .required()
  .unknown(false);


  export const getScanHistorySchema = Joi.object({
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      "string.pattern.base": "Start date must use YYYY-MM-DD format.",
    }),

  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      "string.pattern.base": "End date must use YYYY-MM-DD format.",
    }),

  scanType: Joi.string()
    .valid("ALL", "ARRIVAL", "RETURN")
    .default("ALL")
    .messages({
      "any.only": "Scan type must be ALL, ARRIVAL, or RETURN.",
    }),

  search: Joi.string().trim().max(100).allow("").default(""),

  myScans: Joi.boolean().default(false),

  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(20),
})
  .custom((value, helpers) => {
    const isValidDate = (dateString) => {
      if (!dateString) return true;

      const [year, month, day] = dateString.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));

      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    };

    if (!isValidDate(value.startDate)) {
      return helpers.error("any.invalid", {
        message: "Start date is not a valid calendar date.",
      });
    }

    if (!isValidDate(value.endDate)) {
      return helpers.error("any.invalid", {
        message: "End date is not a valid calendar date.",
      });
    }

    if (
      value.startDate &&
      value.endDate &&
      value.startDate > value.endDate
    ) {
      return helpers.error("any.invalid", {
        message: "Start date cannot be after end date.",
      });
    }

    return value;
  })
  .required()
  .unknown(false);