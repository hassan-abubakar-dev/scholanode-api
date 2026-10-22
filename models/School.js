import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const School = dbConnection.define(
  "School",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ===============================
    // REQUIRED DURING SCHOOL CREATION
    // ===============================

    schoolName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 150],
      },
    },

    schoolCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 20],
      },
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    schoolLevel: {
  type: DataTypes.ENUM(
    "PRIMARY",
    "SECONDARY",
    "COMBINED"
  ),
  allowNull: false,
},

ownershipType: {
  type: DataTypes.ENUM(
    "GOVERNMENT",
    "PRIVATE"
  ),
  allowNull: false,
},

    // ===============================
    // COMPLETED DURING SCHOOL SETUP
    // ===============================

    supportEmail: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },

    supportPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    logoPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },


    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    // ===============================
    // SYSTEM FIELDS
    // ===============================

  status: {
  type: DataTypes.ENUM(
    "PENDING_VERIFICATION",
    "PENDING_ACTIVATION",
    "ACTIVE",
    "SUSPENDED"
  ),
  allowNull: false,
  defaultValue: "PENDING_VERIFICATION",
},
  },
  {
    tableName: "Schools",
    timestamps: true,
  }
);

export default School;