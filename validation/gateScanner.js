
import Joi from "joi";

export const verifyStudentSchema = Joi.object({
  method: Joi.string()
    .valid("QR", "ADMISSION_NUMBER")
    .required()
    .messages({
      "any.only":
        "Method must be QR or ADMISSION_NUMBER.",
      "any.required":
        "Verification method is required.",
    }),

  value: Joi.when("method", {
    is: "QR",
    then: Joi.string()
      .guid()
      .required()
      .messages({
        "string.guid":
          "QR data must contain a valid UUID token.",
        "any.required":
          "QR token is required.",
      }),

    otherwise: Joi.string()
      .trim()
      .min(1)
      .max(30)
      .required()
      .messages({
        "string.empty":
          "Admission number is required.",
        "string.max":
          "Admission number cannot exceed 30 characters.",
        "any.required":
          "Admission number is required.",
      }),
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

