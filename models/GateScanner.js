import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const GateScanner = dbConnection.define(
  "GateScanner",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School granting the scanning permission
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Existing staff user authorized to scan
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Whether the staff member can currently scan
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "GateScanners",
    timestamps: true,

    indexes: [
      {
        // One permission record per user per school
        unique: true,
        fields: ["schoolId", "userId"],
      },
      {
        // Quickly retrieve active scanners for a school
        fields: ["schoolId", "isActive"],
      },
    ],
  }
);

export default GateScanner;