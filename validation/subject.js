import Joi from "joi";

export const updateSubjectSchema = Joi.object({
  subjectName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      "string.empty": "Subject name is required.",
      "string.min": "Subject name must be at least 1 character.",
      "string.max": "Subject name cannot exceed 100 characters.",
      "any.required": "Subject name is required.",
    }),
}).required();