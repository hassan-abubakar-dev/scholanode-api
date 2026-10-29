import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const TimetablePeriod = dbConnection.define(
  "TimetablePeriod",
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

    name: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Period name is required.",
        },
        len: {
          args: [1, 60],
          msg: "Period name must be between 1 and 60 characters.",
        },
      },
    },

    time: {
      type: DataTypes.STRING(80),
      allowNull: true,
      validate: {
        len: {
          args: [0, 80],
          msg: "Period time cannot exceed 80 characters.",
        },
      },
    },

    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: {
          msg: "Period order must be an integer.",
        },
        min: {
          args: [0],
          msg: "Period order cannot be negative.",
        },
      },
    },
  },
  {
    tableName: "TimetablePeriods",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "name"],
        name: "unique_timetable_period_name_per_school",
      },
      {
        fields: ["schoolId", "orderIndex"],
        name: "idx_timetable_period_school_order",
      },
    ],
  }
);

export default TimetablePeriod;