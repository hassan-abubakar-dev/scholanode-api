import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const ClassSubject = dbConnection.define(
  "ClassSubject",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this association
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Class arm offering the subject
    classId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Subject from the school's subject catalogue
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "ClassSubjects",
    timestamps: true,

    indexes: [
      {
        name: "class_subject_unique",
        unique: true,
        fields: ["schoolId", "classId", "subjectId"],
      },
      {
        name: "class_subject_class_index",
        fields: ["schoolId", "classId"],
      },
      {
        name: "class_subject_subject_index",
        fields: ["schoolId", "subjectId"],
      },
    ],
  }
);

export default ClassSubject;