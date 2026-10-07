import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Student = dbConnection.define(
  "Student",
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

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    admissionNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    gender: {
      type: DataTypes.ENUM(
        "MALE",
        "FEMALE"
      ),
      allowNull: false,
    },

    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

      qrToken: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },

    currentClassId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    enrollmentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    admissionStatus: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "GRADUATED",
        "TRANSFERRED",
        "WITHDRAWN"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  {
    tableName: "Students",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "admissionNumber"],
      },
    ],
  }
);

export default Student;