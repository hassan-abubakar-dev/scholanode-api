import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

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

    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
        unique: true,
        fields: ["parentId", "studentId"],
      },
    ],
  }
);

export default ParentStudent;