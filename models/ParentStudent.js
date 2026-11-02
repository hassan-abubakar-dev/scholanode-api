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
        unique: true,
        fields: ["parentId", "studentId"],
      },
    ],
  }
);

export default ParentStudent;