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