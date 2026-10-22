import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const GateScanRecord = dbConnection.define(
  "GateScanRecord",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this scan record
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Student scanned at the school gate
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // User who performed the scan
    scannedByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Type of gate scan
    // ARRIVAL = student arriving at school
    // RETURN = student leaving school
    scanType: {
      type: DataTypes.ENUM("ARRIVAL", "RETURN"),
      allowNull: false,
    },

    // Exact date and time the scan was recorded
    scannedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "GateScanRecords",
    timestamps: true,

    indexes: [
      {
        // Useful for retrieving a student's scan history
        fields: ["schoolId", "studentId", "scannedAt"],
      },
      {
        // Useful for viewing scans by date and type
        fields: ["schoolId", "scanType", "scannedAt"],
      },
      {
        // Useful for reviewing scans performed by a staff member
        fields: ["scannedByUserId", "scannedAt"],
      },
    ],
  }
);

export default GateScanRecord;