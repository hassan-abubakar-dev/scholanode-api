import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const AssessmentComponent = dbConnection.define(
  "AssessmentComponent",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Assessment configuration version this component belongs to
    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Examples: Assignment, First Test, Examination
    componentName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },

    // Maximum raw mark obtainable in this component
    maximumMark: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: 0.01,
      },
    },

    // Percentage contribution to the overall assessment
    weightPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: 0.01,
        max: 100,
      },
    },

    // Display order in the assessment structure
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        isInt: true,
      },
    },
  },
  {
    tableName: "AssessmentComponents",
    timestamps: true,

    indexes: [
  {
    name: "assessment_component_config_order_unique",
    unique: true,
    fields: ["assessmentConfigurationId", "displayOrder"],
  },
],
  }
);

export default AssessmentComponent;