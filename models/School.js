import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

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

    logoKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },


    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
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