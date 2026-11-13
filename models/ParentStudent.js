import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const ParentStudent = dbConnection.define(
  "ParentStudent",
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

    parentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // ===============================
    // RELATIONSHIP INFORMATION
    // ===============================

    relationship: {
      type: DataTypes.ENUM(
        "FATHER",
        "MOTHER",
        "GUARDIAN",
        "OTHER"
      ),
      allowNull: false,
    },

    receivesNotifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "ParentStudents",
    timestamps: true,


indexes: [
  {
    name: "parent_student_unique",
    unique: true,
    fields: ["schoolId", "parentId", "studentId"],
  },
  {
    name: "parent_student_student_index",
    fields: ["schoolId", "studentId"],
  },
],

  }
);

export default ParentStudent;