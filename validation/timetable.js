import Joi from "joi";

const idSchema = Joi.string().trim().required();

const daySchema = Joi.string()
  .trim()
  .uppercase()
  .valid(
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY"
  )
  .messages({
    "any.only": "Please provide a valid day of the week.",
    "any.required": "Day of the week is required.",
    "string.empty": "Day of the week is required.",
  });

const optionalTimeSchema = Joi.string()
  .trim()
  .max(80)
  .allow("", null)
  .messages({
    "string.max": "Period time cannot exceed 80 characters.",
  });

/*
|--------------------------------------------------------------------------
| Query Parameters
|--------------------------------------------------------------------------
*/

export const timetableQuerySchema = Joi.object({
  classId: idSchema.messages({
    "any.required": "Class ID is required.",
    "string.empty": "Class ID is required.",
  }),
});

/*
|--------------------------------------------------------------------------
| Route Parameters
|--------------------------------------------------------------------------
*/

export const periodParamsSchema = Joi.object({
  periodId: idSchema.messages({
    "any.required": "Period ID is required.",
    "string.empty": "Period ID is required.",
  }),
});

export const lessonParamsSchema = Joi.object({
  lessonId: idSchema.messages({
    "any.required": "Lesson ID is required.",
    "string.empty": "Lesson ID is required.",
  }),
});

/*
|--------------------------------------------------------------------------
| Period Validation
|--------------------------------------------------------------------------
*/

export const createPeriodSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(60)
    .required()
    .messages({
      "string.empty": "Period name is required.",
      "string.min": "Period name is required.",
      "string.max": "Period name cannot exceed 60 characters.",
      "any.required": "Period name is required.",
    }),

  time: optionalTimeSchema.optional(),
}).required();

export const updatePeriodSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(60)
    .messages({
      "string.empty": "Period name cannot be empty.",
      "string.min": "Period name is required.",
      "string.max": "Period name cannot exceed 60 characters.",
    }),

  time: optionalTimeSchema.optional(),
})
  .min(1)
  .required();

/*
|--------------------------------------------------------------------------
| Lesson Validation
|--------------------------------------------------------------------------
*/

export const createLessonSchema = Joi.object({
  classId: idSchema.messages({
    "any.required": "Class ID is required.",
    "string.empty": "Class ID is required.",
  }),

  periodId: idSchema.messages({
    "any.required": "Period ID is required.",
    "string.empty": "Period ID is required.",
  }),

  dayOfWeek: daySchema.required(),

  subjectId: idSchema.messages({
    "any.required": "Subject ID is required.",
    "string.empty": "Subject ID is required.",
  }),

  teacherId: Joi.string()
    .trim()
    .allow("", null)
    .optional(),
}).required();

export const updateLessonSchema = Joi.object({
  classId: Joi.string().trim(),

  periodId: Joi.string().trim(),

  dayOfWeek: daySchema.optional(),

  subjectId: Joi.string().trim(),

  teacherId: Joi.string()
    .trim()
    .allow("", null)
    .optional(),
})
  .min(1)
  .required();