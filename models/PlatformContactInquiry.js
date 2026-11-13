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

    // Visitor information
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true,
      },
    },

    // Inquiry information
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
      validate: {
        notEmpty: true,
      },
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    // Contact permission
    allowEmailReply: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Inquiry management
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

    // Platform team member who reviewed the inquiry
    reviewedByPlatformUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // When the inquiry was reviewed
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
        name: "platform_contact_inquiries_status_created_at_idx",
        fields: ["status", "createdAt"],
      },
      {
        name: "platform_contact_inquiries_category_created_at_idx",
        fields: ["category", "createdAt"],
      },
      {
        name: "platform_contact_inquiries_reviewer_status_idx",
        fields: ["reviewedByPlatformUserId", "status"],
      },
    ],
  }
);

export default PlatformContactInquiry;