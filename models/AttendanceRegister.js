import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const AttendanceRegister = dbConnection.define(
  "AttendanceRegister",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this attendance register
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Class whose students are being marked
    classId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Date for which attendance is recorded
    attendanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Academic session to which this register belongs
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Academic term to which this register belongs
    termId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // User who originally created the register
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // DRAFT = attendance can still be completed
    // SUBMITTED = attendance has been finalized
    status: {
      type: DataTypes.ENUM("DRAFT", "SUBMITTED"),
      allowNull: false,
      defaultValue: "DRAFT",
    },
  },
  {
    tableName: "AttendanceRegisters",
    timestamps: true,

    indexes: [
      {
        // Only one register per class per school day
        unique: true,
        fields: ["schoolId", "classId", "attendanceDate"],
      },
      {
        // Useful for filtering attendance by academic session and term
        fields: ["schoolId", "sessionId", "termId"],
      },
    ],
  }
);

export default AttendanceRegister;