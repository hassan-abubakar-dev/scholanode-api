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

    // ===============================
    // CONVERSATION MANAGEMENT
    // ===============================

    status: {
      type: DataTypes.ENUM(
        "OPEN",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED"
      ),
      allowNull: false,
      defaultValue: "OPEN",
    },

    // Internal flag indicating that super-admin attention is needed.
    isEscalated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Platform agent currently handling the conversation.
    // Null means nobody is currently handling it.
    currentHandlerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Platform agent who last escalated the conversation.
    escalatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // When the conversation was escalated.
    escalatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Internal explanation for escalation.
    escalationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
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
      {
        fields: ["status", "isEscalated", "createdAt"],
      },
      {
        fields: ["currentHandlerId", "status"],
      },
    ],
  }
);

export default SupportConversation;