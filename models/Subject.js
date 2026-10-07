import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Subject = dbConnection.define(
  "Subject",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this subject
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Name of the subject
    // Examples:
    // Mathematics
    // English Language
    // Biology  
    // Basic Science
    subjectName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    // Allows a school to deactivate a subject
    // without deleting its historical records
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "Subjects",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "subjectName"],
      },
    ],
  }
);

export default Subject;
