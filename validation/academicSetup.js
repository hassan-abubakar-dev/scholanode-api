import Joi from "joi";

export const createSessionWithTermsSchema = Joi.object({
  session: Joi.object({
    sessionName: Joi.string().trim().min(4).max(20).required().messages({
      "string.empty": "Session name is required.",
      "string.min": "Session name must be at least 4 characters.",
      "string.max": "Session name cannot exceed 20 characters.",
      "any.required": "Session name is required.",
    }),

    startDate: Joi.date().iso().required().messages({
      "date.base": "Session start date must be a valid date.",
      "any.required": "Session start date is required.",
    }),

    endDate: Joi.date().iso().greater(Joi.ref("startDate")).required().messages({
      "date.base": "Session end date must be a valid date.",
      "date.greater": "Session end date must be after the start date.",
      "any.required": "Session end date is required.",
    }),
  }).required(),

  terms: Joi.array()
    .length(3)
    .items(
      Joi.object({
        termName: Joi.string()
          .trim()
          .uppercase()
          .valid("FIRST_TERM", "SECOND_TERM", "THIRD_TERM")
          .required()
          .messages({
            "string.empty": "Term name is required.",
            "any.only": "Term name must be FIRST_TERM, SECOND_TERM, or THIRD_TERM.",
            "any.required": "Term name is required.",
          }),

        startDate: Joi.date().iso().required().messages({
          "date.base": "Term start date must be a valid date.",
          "any.required": "Term start date is required.",
        }),

        endDate: Joi.date().iso().greater(Joi.ref("startDate")).required().messages({
          "date.base": "Term end date must be a valid date.",
          "date.greater": "Term end date must be after the start date.",
          "any.required": "Term end date is required.",
        }),
      })
    )
    .unique("termName")
    .required()
    .messages({
      "array.length": "Exactly three unique terms (FIRST_TERM, SECOND_TERM, THIRD_TERM) are required.",
      "array.unique": "Each term name must be unique within the session.",
      "any.required": "Terms are required.",
    }),
}).required();

const classItemSchema = Joi.object({
  classLevel: Joi.string()
    .trim()
    .min(1)
    .max(20)
    .required()
    .messages({
      "string.empty": "Class level is required.",
      "string.min": "Class level must be at least 1 character.",
      "string.max": "Class level cannot exceed 20 characters.",
      "any.required": "Class level is required.",
    }),

  arm: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .allow(null, "")
    .optional()
    .messages({
      "string.min": "Class arm must be at least 1 character.",
      "string.max": "Class arm cannot exceed 50 characters.",
    }),
}).required();

export const createClassSchema = Joi.alternatives()
  .try(
    classItemSchema,
    Joi.array().items(classItemSchema).min(1).max(100)
  )
  .required()
  .messages({
    "alternatives.match":
      "Provide one valid class object or an array of valid class objects.",
    "array.min": "Provide at least one class to create.",
    "array.max": "You cannot create more than 100 classes at once.",
    "any.required": "Class data is required.",
  });



const singleSubjectSchema = Joi.object({
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

const multipleSubjectsSchema = Joi.object({
  subjects: Joi.array()
    .items(singleSubjectSchema)
    .min(1)
    .required()
    .messages({
      "array.base": "Subjects must be an array.",
      "array.min": "At least one subject is required.",
      "any.required": "The subjects field is required.",
    }),
}).required();

export const createSubjectSchema = Joi.alternatives()
  .try(singleSubjectSchema, multipleSubjectsSchema)
  .required();
