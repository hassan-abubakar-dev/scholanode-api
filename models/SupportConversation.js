import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const SupportConversation = dbConnection.define(
  "SupportConversation",
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

    // The school user who initiated the conversation.
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // ===============================
    // CONVERSATION INFORMATION
    // ===============================

    category: {
      type: DataTypes.ENUM(
        "TECHNICAL_ISSUE",
        "ACCOUNT_AND_ACCESS",
        "BILLING_AND_PAYMENT",
        "BUG_REPORT",
        "FEATURE_REQUEST",
        "GENERAL_INQUIRY",
        "OTHER"
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

    // ===============================
    // CONVERSATION MANAGEMENT
    // ===============================

    status: {
      type: DataTypes.ENUM(
        "OPEN",
        "IN_PROGRESS",
        "ESCALATED",
        "RESOLVED",
        "CLOSED"
      ),
      allowNull: false,
      defaultValue: "OPEN",
    },

    // When the conversation was marked as resolved.
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // When the conversation was formally closed.
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "SupportConversations",
    timestamps: true,

    indexes: [
      {
        fields: ["schoolId", "status", "createdAt"],
      },
      {
        fields: ["schoolId", "createdByUserId", "createdAt"],
      },
      {
        fields: ["schoolId", "category"],
      },
    ],
  }
);

export default SupportConversation;