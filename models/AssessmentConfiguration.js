import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const AssessmentConfiguration = dbConnection.define(
  "AssessmentConfiguration",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this assessment configuration
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Educational section this configuration applies to
    educationSection: {
      type: DataTypes.ENUM(
        "EARLY_YEARS",
        "PRIMARY",
        "JUNIOR_SECONDARY",
        "SENIOR_SECONDARY"
      ),
      allowNull: false,
    },

    // Version number within a school's educational section
    versionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        isInt: true,
      },
    },

    // Configuration lifecycle
    status: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "PENDING",
        "SUPERSEDED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    // Previous version of this same section's configuration
    previousVersionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // First term in which this version applies
    effectiveFromTermId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Last term in which this version applies
    // Null means no end has been scheduled.
    effectiveUntilTermId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Administrator who created this version
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "AssessmentConfigurations",
    timestamps: true,

    indexes: [
      {
        name: "assessment_config_school_section_version_unique",
        unique: true,
        fields: ["schoolId", "educationSection", "versionNumber"],
      },
      {
        name: "assessment_config_school_section_status",
        fields: ["schoolId", "educationSection", "status"],
      },
      {
        name: "assessment_config_effective_from_term",
        fields: ["effectiveFromTermId"],
      },
      {
        name: "assessment_config_effective_until_term",
        fields: ["effectiveUntilTermId"],
      },
      {
        name: "assessment_config_previous_version",
        fields: ["previousVersionId"],
      },
      {
  name: "assessment_config_school_id_id_unique",
  unique: true,
  fields: ["schoolId", "id"],
},
  {
    name: "assessment_config_one_active_per_section",
    unique: true,
    fields: ["schoolId", "educationSection"],
    where: { status: "ACTIVE" },
  },
    ],
  }
);

export default AssessmentConfiguration;