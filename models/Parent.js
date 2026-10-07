import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Parent = dbConnection.define(
  "Parent",
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

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },

    // ===============================
    // PARENT IDENTIFICATION
    // ===============================

    parentId: {
      type: DataTypes.STRING(30),
      allowNull: false,
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
  },
  {
    tableName: "Parents",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "parentId"],
      },
    ],
  }
);

export default Parent;