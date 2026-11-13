
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Student = dbConnection.define(
  "Student",
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
    },

    admissionNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    gender: {
      type: DataTypes.ENUM("MALE", "FEMALE"),
      allowNull: false,
    },

    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    qrToken: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },

    currentClassId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    enrollmentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    admissionStatus: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "GRADUATED",
        "TRANSFERRED",
        "WITHDRAWN"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  {
    tableName: "Students",
    timestamps: true,

    indexes: [
      // Admission numbers must be unique within each school.
      {
        unique: true,
        name: "students_school_id_admission_number_unique",
        fields: ["schoolId", "admissionNumber"],
      },

      // One user account can have only one student profile.
      {
        unique: true,
        name: "students_user_id_unique",
        fields: ["userId"],
      },

      // Supports the composite foreign key to Classes.
      {
        unique: true,
        name: "students_school_id_id_unique",
        fields: ["schoolId", "id"],
      },
      
    ],
  }
);

export default Student;
