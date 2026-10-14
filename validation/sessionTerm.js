
import Joi from "joi";

export const sessionParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
});

export const sessionTermParamsSchema = Joi.object({
  sessionId: Joi.string().trim().required(),
  termId: Joi.string().trim().required(),
});



export const updateSessionWithTermsSchema = Joi.object({
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

    endDate: Joi.date()
      .iso()
      .greater(Joi.ref("startDate"))
      .required()
      .messages({
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
          .required(),

        startDate: Joi.date().iso().required(),

        endDate: Joi.date()
          .iso()
          .greater(Joi.ref("startDate"))
          .required(),
      })
    )
    .unique("termName")
    .required()
    .messages({
      "array.length": "Exactly three terms are required.",
      "array.unique": "Each term name must be unique.",
      "any.required": "Terms are required.",
    }),
}).required();
