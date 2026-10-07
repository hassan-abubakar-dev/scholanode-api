import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Term = dbConnection.define(
  "Term",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Academic session this term belongs to
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Examples:
    // FIRST_TERM
    // SECOND_TERM
    // THIRD_TERM
    termName: {
      type: DataTypes.ENUM(
        "FIRST_TERM",
        "SECOND_TERM",
        "THIRD_TERM"
      ),
      allowNull: false,
    },

    // Term start date
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Term end date
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Term lifecycle
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

    // Indicates the current term
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "Terms",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["sessionId", "termName"],
      },
    ],
  }
);

export default Term;