import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Complaint = dbConnection.define(
  "Complaint",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ===============================
    // SCHOOL & SENDER INFORMATION
    // ===============================

    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Hide sender identity from school administrators
    // when this complaint is anonymous.
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // ===============================
    // COMPLAINT INFORMATION
    // ===============================

    category: {
      type: DataTypes.ENUM(
        "ACADEMIC",
        "STAFF_CONDUCT",
        "STUDENT_WELFARE",
        "FEES_AND_PAYMENTS",
        "FACILITIES",
        "ATTENDANCE",
        "GENERAL"
      ),
      allowNull: false,
    },

    subject: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 150],
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [10, 5000],
      },
    },

    // ===============================
    // COMPLAINT MANAGEMENT
    // ===============================

    status: {
      type: DataTypes.ENUM(
        "SUBMITTED",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED"
      ),
      allowNull: false,
      defaultValue: "SUBMITTED",
    },

    // Optional reason when an administrator closes
    // a complaint as invalid or otherwise unsuitable.
    resolutionNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "Complaints",
    timestamps: true,

    indexes: [
      {
        fields: ["schoolId", "status", "createdAt"],
      },
      {
        fields: ["schoolId", "senderId", "createdAt"],
      },
      {
        fields: ["schoolId", "category"],
      },
    ],
  }
);

export default Complaint;