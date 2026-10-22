import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const WorkingDay = dbConnection.define(
  "WorkingDay",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },

    days: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
      ],
      validate: {
        isValidWorkingDays(value) {
          const allowedDays = [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
          ];

          if (
            !Array.isArray(value) ||
            value.length === 0 ||
            new Set(value).size !== value.length ||
            !value.every((day) => allowedDays.includes(day))
          ) {
            throw new Error("Please provide valid working days.");
          }
        },
      },
    },
  },
  {
    tableName: "WorkingDays",
    timestamps: true,
  }
);

export default WorkingDay;