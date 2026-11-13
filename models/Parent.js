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
      allowNull: false
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
    name: "parents_school_id_user_id_unique",
    unique: true,
    fields: ["schoolId", "userId"],
  },
  {
    name: "parents_school_id_id_unique",
    unique: true,
    fields: ["schoolId", "id"],
  },
],

  }
);

export default Parent;