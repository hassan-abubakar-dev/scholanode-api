
import { DataTypes, Op } from "sequelize";
import { dbConnection } from "../config/db.js";

const Class = dbConnection.define(
  "Class",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this class
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Examples:
    // Primary 1
    // Primary 6
    // JSS1
    // SS2
    classLevel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 20],
      },
    },

    // Examples:
    // A
    // B
    // Gold
    // Blue
    // Science
    // Commercial
    arm: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [1, 50],
      },
    },

    // Educational section grouping
    educationSection: {
      type: DataTypes.ENUM(
        "EARLY_YEARS",
        "PRIMARY",
        "JUNIOR_SECONDARY",
        "SENIOR_SECONDARY"
      ),
      allowNull: false,
      defaultValue: "PRIMARY",
      validate: {
        isIn: {
          args: [
            [
              "EARLY_YEARS",
              "PRIMARY",
              "JUNIOR_SECONDARY",
              "SENIOR_SECONDARY",
            ],
          ],
          msg: "Invalid educational section.",
        },
      },
    },

    // Assigned class teacher
    formMasterId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "Classes",
    timestamps: true,

   indexes: [
  // Only one unarmed class per school and class level
  {
    name: "classes_unarmed_unique",
    unique: true,
    fields: ["schoolId", "classLevel"],
    where: {
      arm: null,
    },
  },

  // Each arm must be unique within its school and class level
  {
    name: "classes_armed_unique",
    unique: true,
    fields: ["schoolId", "classLevel", "arm"],
    where: {
      arm: {
        [Op.ne]: null,
      },
    },
  },

  // Supports the composite foreign key from Students
  {
    name: "classes_school_id_id_unique",
    unique: true,
    fields: ["schoolId", "id"],
  },
],
  }
);

export default Class;
