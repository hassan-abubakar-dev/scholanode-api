import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const SubjectAssignment = dbConnection.define(
  "SubjectAssignment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Teacher (User table)
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Assigned class
    classId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Assigned subject
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Academic session
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Academic term
    termId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Enable or disable the assignment
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "SubjectAssignments",
    timestamps: true,

    indexes: [
      {
        name: "subject_assignment_unique",
        unique: true,
        fields: [
          "userId",
          "classId",
          "subjectId",
          "sessionId",
          "termId",
        ],
      },
    ],
  }
);

export default SubjectAssignment;