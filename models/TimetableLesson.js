import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const TimetableLesson = dbConnection.define(
  "TimetableLesson",
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

    classId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    periodId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    dayOfWeek: {
      type: DataTypes.ENUM(
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY"
      ),
      allowNull: false,
      validate: {
        isValidWorkingDay(value) {
          const allowedDays = [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
          ];

          if (!allowedDays.includes(value)) {
            throw new Error("Please provide a valid day of the week.");
          }
        },
      },
    },

    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    teacherId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "TimetableLessons",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["schoolId", "classId", "periodId", "dayOfWeek"],
        name: "unique_timetable_lesson_slot",
      },
      {
        fields: ["schoolId", "classId"],
        name: "idx_timetable_lesson_school_class",
      },
      {
        fields: ["schoolId", "teacherId", "dayOfWeek"],
        name: "idx_timetable_lesson_teacher_day",
      },
      {
        fields: ["schoolId", "subjectId"],
        name: "idx_timetable_lesson_school_subject",
      },
    ],
  }
);

export default TimetableLesson;