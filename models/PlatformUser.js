import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const PlatformUser = dbConnection.define(
  "PlatformUser",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ===============================
    // BASIC INFORMATION
    // ===============================

    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    surName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    // ===============================
    // LOGIN INFORMATION
    // ===============================

    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // ===============================
    // PLATFORM ROLE
    // ===============================

    role: {
      type: DataTypes.ENUM(
        "PLATFORM_ADMIN",
        "SUPPORT_AGENT"
      ),
      allowNull: false,
    },

    // ===============================
    // OPTIONAL PROFILE INFORMATION
    // ===============================

    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    profileImageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    profileImagePublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // ===============================
    // ACCOUNT MANAGEMENT
    // ===============================

    status: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "INACTIVE",
        "SUSPENDED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "PlatformUsers",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        fields: ["role", "status"],
      },
    ],
  }
);

export default PlatformUser;