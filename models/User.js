import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const User = dbConnection.define(
  "User",
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

  loginId: {
  type: DataTypes.STRING(100),
  allowNull: false,
},

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    mustChangePassword: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},

profileCompleted: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
},

role: {
    type: DataTypes.ENUM(
        "LEADER",
        "VICE_LEADER",
        "ADMINISTRATOR",
        "EXAM_OFFICER",
        "STAFF",
        "PARENT",
        "STUDENT",
        "SECURITY",
    ),
    allowNull: false,
},

    // ===============================
    // OPTIONAL PROFILE INFORMATION
    // ===============================

    email: {
  type: DataTypes.STRING(100),
  allowNull: true,
  validate: {
    isEmail: true,
  },
},

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
    // SYSTEM INFORMATION
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

    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "Users",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "loginId"],
      },
    ],
  }
);

export default User;