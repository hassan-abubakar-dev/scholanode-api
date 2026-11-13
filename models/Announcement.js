import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Announcement = dbConnection.define(
  "Announcement",
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

    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200],
      },
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    audience: {
      type: DataTypes.ENUM(
        "STAFF",
        "STUDENTS",
        "PARENTS",
        "SECURITY"
      ),
      allowNull: false,
    },
  },
  {
    tableName: "Announcements",
    timestamps: true,

    indexes: [
      {
        name: "announcements_school_created_at_idx",
        fields: ["schoolId", "createdAt"],
      },
      {
        name: "announcements_created_by_idx",
        fields: ["createdBy"],
      },
    ],
  }
);

export default Announcement;