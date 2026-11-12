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

export const saveWorkingDaysSchema = Joi.object({
  days: Joi.array()
    .items(
      Joi.string()
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
    )
    .min(1)
    .max(7)
    .unique()
    .required(),
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

  educationSection: Joi.string()
    .trim()
    .uppercase()
    .valid("EARLY_YEARS", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY")
    .optional()
    .messages({
      "any.only":
        "Educational section must be EARLY_YEARS, PRIMARY, JUNIOR_SECONDARY, or SENIOR_SECONDARY.",
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


  const assessmentComponentSchema = Joi.object({
  componentName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Assessment component name is required.",
      "string.min": "Assessment component name must be at least 2 characters.",
      "string.max": "Assessment component name cannot exceed 100 characters.",
      "any.required": "Assessment component name is required.",
    }),

  maximumMark: Joi.number()
    .positive()
    .max(999999.99)
    .precision(2)
    .required()
    .messages({
      "number.base": "Maximum mark must be a number.",
      "number.positive": "Maximum mark must be greater than zero.",
      "number.max": "Maximum mark cannot exceed 999999.99.",
      "number.precision": "Maximum mark cannot have more than 2 decimal places.",
      "any.required": "Maximum mark is required.",
    }),

  weightPercentage: Joi.number()
    .positive()
    .max(100)
    .precision(2)
    .required()
    .messages({
      "number.base": "Weight percentage must be a number.",
      "number.positive": "Weight percentage must be greater than zero.",
      "number.max": "Weight percentage cannot exceed 100%.",
      "number.precision": "Weight percentage cannot have more than 2 decimal places.",
      "any.required": "Weight percentage is required.",
    }),
}).required();

export const createAssessmentConfigurationSchema = Joi.object({
  educationSection: Joi.string()
    .valid(
      "EARLY_YEARS",
      "PRIMARY",
      "JUNIOR_SECONDARY",
      "SENIOR_SECONDARY"
    )
    .required()
    .messages({
      "any.only": "Select a valid educational section.",
      "any.required": "Educational section is required.",
    }),

  effectiveFromTermId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "A valid effective term ID is required.",
      "any.required": "Select the term from which this configuration becomes effective.",
    }),

  components: Joi.array()
    .items(assessmentComponentSchema)
    .min(1)
    .required()
    .custom((components, helpers) => {
      const names = components.map((component) =>
        component.componentName.trim().toLowerCase()
      );

      if (new Set(names).size !== names.length) {
        return helpers.error("array.unique");
      }

      const totalWeight = components.reduce(
        (total, component) => total + component.weightPercentage,
        0
      );

      // Avoid floating-point comparison problems.
      if (Math.round(totalWeight * 100) !== 10000) {
        return helpers.error("any.custom");
      }

      return components;
    })
    .messages({
      "array.min": "At least one assessment component is required.",
      "array.unique": "Assessment component names must be unique.",
      "any.custom": "Assessment component weight percentages must total exactly 100%.",
      "any.required": "Assessment components are required.",
    }),
}).required();