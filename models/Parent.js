import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

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
    fields: ["schoolId", "userId"],
  },
],
  }
);

export default Parent;