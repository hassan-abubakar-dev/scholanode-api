import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const SchoolInquiry = dbConnection.define(
  "SchoolInquiry",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Schools",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },

    contact: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    subject: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 150],
      },
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [10, 5000],
      },
    },

    status: {
      type: DataTypes.ENUM("NEW", "REVIEWED"),
      allowNull: false,
      defaultValue: "NEW",
    },
  },
  {
    tableName: "SchoolInquiries",
    timestamps: true,
    indexes: [
      {
        name: "school_inquiries_school_status_created_idx",
        fields: ["schoolId", "status", "createdAt"],
      },
      {
        name: "school_inquiries_school_created_idx",
        fields: ["schoolId", "createdAt"],
      },
    ],
  }
);

export default SchoolInquiry;