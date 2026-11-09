
import Joi from "joi";

const educationSectionValues = [
  "EARLY_YEARS",
  "PRIMARY",
  "JUNIOR_SECONDARY",
  "SENIOR_SECONDARY",
];

// ============================================================
// EDUCATIONAL SECTION PARAMS
// ============================================================

export const educationSectionParamsSchema = Joi.object({
  educationSection: Joi.string()
    .valid(...educationSectionValues)
    .required()
    .messages({
      "any.only": "Invalid educational section.",
      "any.required": "Educational section is required.",
    }),
});

// ============================================================
// CONFIGURATION QUERY FILTER
// ============================================================

export const assessmentConfigurationsQuerySchema = Joi.object({
  educationSection: Joi.string()
    .valid(...educationSectionValues)
    .optional()
    .messages({
      "any.only": "Invalid educational section.",
    }),
});

// ============================================================
// CREATE PENDING ASSESSMENT CONFIGURATION VERSION
// ============================================================

export const updateAssessmentConfigurationSchema = Joi.object({
  components: Joi.array()
    .min(1)
    .items(
      Joi.object({
        componentName: Joi.string()
          .trim()
          .min(2)
          .max(100)
          .required()
          .messages({
            "string.empty": "Component name is required.",
            "string.min":
              "Component name must contain at least 2 characters.",
            "string.max":
              "Component name cannot exceed 100 characters.",
            "any.required": "Component name is required.",
          }),

        maximumMark: Joi.number()
          .positive()
          .max(999999.99)
          .precision(2)
          .required()
          .messages({
            "number.base": "Maximum mark must be a number.",
            "number.positive":
              "Maximum mark must be greater than zero.",
            "number.max":
              "Maximum mark cannot exceed 999999.99.",
            "number.precision":
              "Maximum mark can have at most 2 decimal places.",
            "any.required": "Maximum mark is required.",
          }),

        weightPercentage: Joi.number()
          .positive()
          .max(100)
          .precision(2)
          .required()
          .messages({
            "number.base": "Weight percentage must be a number.",
            "number.positive":
              "Weight percentage must be greater than zero.",
            "number.max":
              "Weight percentage cannot exceed 100%.",
            "number.precision":
              "Weight percentage can have at most 2 decimal places.",
            "any.required": "Weight percentage is required.",
          }),
      }).required()
    )
    .required()
    .custom((components, helpers) => {
      const normalizedNames = components.map((component) =>
        component.componentName.trim().toLowerCase()
      );

      if (
        new Set(normalizedNames).size !==
        normalizedNames.length
      ) {
        return helpers.error("components.duplicateNames");
      }

      const totalWeight = components.reduce(
        (total, component) =>
          total + component.weightPercentage,
        0
      );

      if (Math.round(totalWeight * 100) !== 10000) {
        return helpers.error("components.invalidTotal");
      }

      return components;
    })
    .messages({
      "array.min":
        "At least one assessment component is required.",
      "array.base":
        "Assessment components must be provided as an array.",
      "components.duplicateNames":
        "Assessment component names must be unique.",
      "components.invalidTotal":
        "Assessment component weight percentages must total exactly 100%.",
      "any.required":
        "Assessment components are required.",
    }),
});
