
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const AttendanceRecord = dbConnection.define(
  "AttendanceRecord",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this attendance record
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
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
        name: "attendance_record_register_student_unique",
        unique: true,
        fields: ["schoolId", "attendanceRegisterId", "studentId"],
      },
      {
        name: "attendance_record_school_student_index",
        fields: ["schoolId", "studentId"],
      },
    ],
  }
);

export default AttendanceRecord;
