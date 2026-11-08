import Joi from "joi";

/*
|--------------------------------------------------------------------------
| Reusable Schemas
|--------------------------------------------------------------------------
*/

const idSchema = Joi.string()
  .guid({ version: ["uuidv4"] })
  .required()
  .messages({
    "string.guid": "Please provide a valid ID.",
    "any.required": "ID is required.",
    "string.empty": "ID is required.",
  });

const optionalIdSchema = Joi.string()
  .guid({ version: ["uuidv4"] })
  .allow("", null)
  .optional()
  .messages({
    "string.guid": "Please provide a valid ID.",
  });

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
  .optional()
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
    "string.guid": "Please provide a valid class ID.",
    "any.required": "Class ID is required.",
    "string.empty": "Class ID is required.",
  }),
}).required();

/*
|--------------------------------------------------------------------------
| Route Parameters
|--------------------------------------------------------------------------
*/

export const periodParamsSchema = Joi.object({
  periodId: idSchema.messages({
    "string.guid": "Please provide a valid period ID.",
    "any.required": "Period ID is required.",
    "string.empty": "Period ID is required.",
  }),
}).required();

export const lessonParamsSchema = Joi.object({
  lessonId: idSchema.messages({
    "string.guid": "Please provide a valid lesson ID.",
    "any.required": "Lesson ID is required.",
    "string.empty": "Lesson ID is required.",
  }),
}).required();

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

  time: optionalTimeSchema,
})
  .required();

export const updatePeriodSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(60)
    .optional()
    .messages({
      "string.empty": "Period name cannot be empty.",
      "string.min": "Period name is required.",
      "string.max": "Period name cannot exceed 60 characters.",
    }),

  time: optionalTimeSchema,
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
    "string.guid": "Please provide a valid class ID.",
    "any.required": "Class ID is required.",
    "string.empty": "Class ID is required.",
  }),

  periodId: idSchema.messages({
    "string.guid": "Please provide a valid period ID.",
    "any.required": "Period ID is required.",
    "string.empty": "Period ID is required.",
  }),

  dayOfWeek: daySchema.required(),

  subjectId: idSchema.messages({
    "string.guid": "Please provide a valid subject ID.",
    "any.required": "Subject ID is required.",
    "string.empty": "Subject ID is required.",
  }),

  teacherId: optionalIdSchema,
})
  .required();

export const updateLessonSchema = Joi.object({
  periodId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .optional()
    .messages({
      "string.guid": "Please provide a valid period ID.",
    }),

  dayOfWeek: daySchema.optional(),

  subjectId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .optional()
    .messages({
      "string.guid": "Please provide a valid subject ID.",
    }),

  teacherId: optionalIdSchema,
})
  .min(1)
  .required();