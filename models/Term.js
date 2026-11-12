import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

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
    name: "terms_session_id_term_name_unique",
    fields: ["sessionId", "termName"],
  },
  {
    unique: true,
    name: "terms_one_current_per_session",
    fields: ["sessionId"],
    where: {
      isCurrent: true,
    },
  },
],
  }
);

export default Term;