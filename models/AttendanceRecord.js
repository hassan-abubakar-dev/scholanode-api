import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const AttendanceRecord = dbConnection.define(
  "AttendanceRecord",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Attendance register this record belongs to
    attendanceRegisterId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Student whose attendance is being recorded
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Student's attendance status
    // null = not yet confirmed
    // PRESENT = student is present
    // ABSENT = student is absent
    status: {
      type: DataTypes.ENUM("PRESENT", "ABSENT"),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "AttendanceRecords",
    timestamps: true,

    indexes: [
      {
        // A student can appear only once in a register
        unique: true,
        fields: ["attendanceRegisterId", "studentId"],
      },
      {
        // Useful when retrieving a student's attendance history
        fields: ["studentId"],
      },
    ],
  }
);

export default AttendanceRecord;