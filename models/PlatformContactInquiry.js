import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const PlatformContactInquiry = dbConnection.define(
  "PlatformContactInquiry",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ===============================
    // VISITOR INFORMATION
    // ===============================

    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },

    // ===============================
    // INQUIRY INFORMATION
    // ===============================

    category: {
      type: DataTypes.ENUM(
        "SCHOOL_REGISTRATION",
        "ACCOUNT_ACTIVATION",
        "SUBSCRIPTION_AND_BILLING",
        "TECHNICAL_SUPPORT",
        "PARTNERSHIP",
        "GENERAL_INQUIRY",
        "OTHER"
      ),
      allowNull: false,
    },

    subject: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // ===============================
    // CONTACT PERMISSION
    // ===============================

    allowEmailReply: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // ===============================
    // INQUIRY MANAGEMENT
    // ===============================

    status: {
      type: DataTypes.ENUM(
        "NEW",
        "REVIEWED",
        "REPLIED",
        "CLOSED"
      ),
      allowNull: false,
      defaultValue: "NEW",
    },

    // Platform team member who reviewed the inquiry.
    reviewedByPlatformUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // When the inquiry was reviewed.
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "PlatformContactInquiries",
    timestamps: true,

    indexes: [
      {
        fields: ["status", "createdAt"],
      },
      {
        fields: ["category", "createdAt"],
      },
      {
        fields: ["reviewedByPlatformUserId", "status"],
      },
    ],
  }
);

export default PlatformContactInquiry;