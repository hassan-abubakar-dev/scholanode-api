
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const AssessmentSheet = dbConnection.define(
  "AssessmentSheet",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this assessment sheet
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Academic term
    termId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Class receiving the assessment
    classId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Subject being assessed
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Exact assessment configuration used
    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Currently assigned teacher
    teacherId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // User who generated the sheet
    generatedById: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Teacher who submitted the sheet
    submittedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Assessment sheet lifecycle
    status: {
      type: DataTypes.ENUM(
        "NOT_STARTED",
        "DRAFT",
        "SUBMITTED"
      ),
      allowNull: false,
      defaultValue: "NOT_STARTED",
    },

    // Submission timestamp
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "AssessmentSheets",
    timestamps: true,

    indexes: [
      {
        name: "assessment_sheet_term_class_subject_unique",
        unique: true,
        fields: ["termId", "classId", "subjectId"],
      },
      {
        name: "assessment_sheet_school_term",
        fields: ["schoolId", "termId"],
      },
      {
        name: "assessment_sheet_teacher_status",
        fields: ["teacherId", "status"],
      },
      {
        name: "assessment_sheet_configuration",
        fields: ["assessmentConfigurationId"],
      },
    ],
  }
);

export default AssessmentSheet;
