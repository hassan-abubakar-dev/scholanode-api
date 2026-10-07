import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Session = dbConnection.define(
  "Session",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this academic session
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Examples:
    // 2024/2025
    // 2025/2026
    sessionName: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [4, 20],
      },
    },

    // Academic session start date
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Academic session end date
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Session lifecycle
    // UPCOMING
    // ACTIVE
    // COMPLETED
    status: {
      type: DataTypes.ENUM(
        "UPCOMING",
        "ACTIVE",
        "COMPLETED"
      ),
      allowNull: false,
      defaultValue: "UPCOMING",
    },

    // Indicates the session currently used by the system
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "Sessions",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "sessionName"],
      },
    ],
  }
);

export default Session;