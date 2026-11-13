
export async function up({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");

  await queryInterface.sequelize.transaction(async (transaction) => {
    // Supporting unique index required for the composite
    // foreign key referencing AttendanceRegisters(schoolId, id)
    await queryInterface.addIndex(
      "AttendanceRegisters",
      ["schoolId", "id"],
      {
        name: "attendance_register_school_id_id_unique",
        unique: true,
        transaction,
      }
    );

    // Create AttendanceRecords table
    await queryInterface.createTable(
      "AttendanceRecords",
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        },

        schoolId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        attendanceRegisterId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        studentId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM("PRESENT", "ABSENT"),
          allowNull: true,
          defaultValue: null,
        },

        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      { transaction }
    );

    // Attendance record must belong to a school
    await queryInterface.addConstraint("AttendanceRecords", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "attendance_record_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Attendance register must belong to the same school
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "AttendanceRecords"
        ADD CONSTRAINT "attendance_record_register_same_school_fk"
        FOREIGN KEY ("schoolId", "attendanceRegisterId")
        REFERENCES "AttendanceRegisters" ("schoolId", "id")
        ON UPDATE CASCADE
        ON DELETE CASCADE;
      `,
      { transaction }
    );

    // Student must belong to the same school
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "AttendanceRecords"
        ADD CONSTRAINT "attendance_record_student_same_school_fk"
        FOREIGN KEY ("schoolId", "studentId")
        REFERENCES "Students" ("schoolId", "id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
      `,
      { transaction }
    );

    // One record per student per attendance register
    await queryInterface.addIndex(
      "AttendanceRecords",
      ["schoolId", "attendanceRegisterId", "studentId"],
      {
        name: "attendance_record_register_student_unique",
        unique: true,
        transaction,
      }
    );

    // Student attendance history lookup
    await queryInterface.addIndex(
      "AttendanceRecords",
      ["schoolId", "studentId"],
      {
        name: "attendance_record_school_student_index",
        transaction,
      }
    );
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("AttendanceRecords", {
      transaction,
    });

    await queryInterface.removeIndex(
      "AttendanceRegisters",
      "attendance_register_school_id_id_unique",
      { transaction }
    );
  });
}
