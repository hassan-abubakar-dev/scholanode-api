import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const AssessmentScore = dbConnection.define(
  "AssessmentScore",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this score
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Assessment sheet this score belongs to
    assessmentSheetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Student receiving the score
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Assessment component (Assignment, Test, Examination, etc.)
    assessmentComponentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Actual score entered by the teacher
    score: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
  },
  {
    tableName: "AssessmentScores",
    timestamps: true,

    indexes: [
      {
        name: "assessment_score_sheet_student_component_unique",
        unique: true,
        fields: [
          "assessmentSheetId",
          "studentId",
          "assessmentComponentId",
        ],
      },
      {
        name: "assessment_score_school_sheet",
        fields: ["schoolId", "assessmentSheetId"],
      },
      {
        name: "assessment_score_student",
        fields: ["studentId"],
      },
    ],
  }
);

export default AssessmentScore;