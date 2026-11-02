import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Owner = dbConnection.define(
  "Owner",
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
    }
  },
  {
    tableName: "Owners",
    timestamps: true,

    indexes: [
      {
        unique: true,
         fields: ["schoolId", "userId"],
      },
    ],
  }
);

export default Owner;