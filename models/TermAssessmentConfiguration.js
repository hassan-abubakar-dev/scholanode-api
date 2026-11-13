import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const TermAssessmentConfiguration = dbConnection.define(
  "TermAssessmentConfiguration",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    termId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    educationSection: {
      type: DataTypes.ENUM(
        "EARLY_YEARS",
        "PRIMARY",
        "JUNIOR_SECONDARY",
        "SENIOR_SECONDARY"
      ),
      allowNull: false,
    },

    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    assignedBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "TermAssessmentConfigurations",
    timestamps: true,

 indexes: [
  {
    name: "term_assessment_section_unique",
    unique: true,
    fields: ["termId", "educationSection"],
  },
  {
    name: "term_assessment_configuration_index",
    fields: ["schoolId", "assessmentConfigurationId"],
  },
  {
    name: "term_assessment_assigned_by_index",
    fields: ["schoolId", "assignedBy"],
  },
  {
    name: "term_assessment_school_term_configuration_unique",
    unique: true,
    fields: ["schoolId", "termId", "assessmentConfigurationId"],
  },
],
  }
);

export default TermAssessmentConfiguration;