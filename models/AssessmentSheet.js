
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
  name: "assessment_sheet_school_id_id_unique",
  unique: true,
  fields: ["schoolId", "id"],
},
  {
    name: "assessment_sheet_term_class_subject_unique",
    unique: true,
    fields: ["termId", "classId", "subjectId"],
  },
  {
    name: "assessment_sheet_class_subject_index",
    fields: ["schoolId", "classId", "subjectId"],
  },
  {
    name: "assessment_sheet_subject_index",
    fields: ["schoolId", "subjectId"],
  },
  {
    name: "assessment_sheet_school_term_configuration",
    fields: ["schoolId", "termId", "assessmentConfigurationId"],
  },
  {
    name: "assessment_sheet_teacher_status",
    fields: ["schoolId", "teacherId", "status"],
  },
  {
    name: "assessment_sheet_configuration",
    fields: ["schoolId", "assessmentConfigurationId"],
  },
  {
    name: "assessment_sheet_generated_by",
    fields: ["schoolId", "generatedById"],
  },
  {
    name: "assessment_sheet_submitted_by",
    fields: ["schoolId", "submittedById"],
  },
],

  }
);

export default AssessmentSheet;
