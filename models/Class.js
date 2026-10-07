import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Class = dbConnection.define(
  "Class",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this class
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Examples:
    // Primary 1
    // Primary 6
    // JSS1
    // SS2
    classLevel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 20],
      },
    },

    // Examples:
    // A
    // B
    // Gold
    // Blue
    // Science
    // Commercial
    arm: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },

    // Assigned class teacher
    formMasterId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "Classes",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "classLevel", "arm"],
      },
    ],
  }
);

export default Class;