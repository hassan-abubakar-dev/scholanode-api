
export async function up({ context: queryInterface }) {
  const { DataTypes } = await import("sequelize");

  await queryInterface.sequelize.transaction(async (transaction) => {
    // Supporting unique index for same-school session reference
    await queryInterface.addIndex("Sessions", ["schoolId", "id"], {
      name: "sessions_school_id_id_unique",
      unique: true,
      transaction,
    });

    await queryInterface.createTable(
      "AttendanceRegisters",
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
        classId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        attendanceDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        sessionId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        termId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        createdByUserId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM("DRAFT", "SUBMITTED"),
          allowNull: false,
          defaultValue: "DRAFT",
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

    // School ownership
    await queryInterface.addConstraint("AttendanceRegisters", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "attendance_register_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Class must belong to the same school
    await queryInterface.sequelize.query(`
      ALTER TABLE "AttendanceRegisters"
      ADD CONSTRAINT "attendance_register_class_same_school_fk"
      FOREIGN KEY ("schoolId", "classId")
      REFERENCES "Classes" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // Session must belong to the same school
    await queryInterface.sequelize.query(`
      ALTER TABLE "AttendanceRegisters"
      ADD CONSTRAINT "attendance_register_session_same_school_fk"
      FOREIGN KEY ("schoolId", "sessionId")
      REFERENCES "Sessions" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // Protect academic history
    await queryInterface.addConstraint("AttendanceRegisters", {
      fields: ["termId"],
      type: "foreign key",
      name: "attendance_register_term_fk",
      references: {
        table: "Terms",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // Creator must belong to the same school
    await queryInterface.sequelize.query(`
      ALTER TABLE "AttendanceRegisters"
      ADD CONSTRAINT "attendance_register_creator_same_school_fk"
      FOREIGN KEY ("schoolId", "createdByUserId")
      REFERENCES "Users" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // One register per class per school day
    await queryInterface.addIndex(
      "AttendanceRegisters",
      ["schoolId", "classId", "attendanceDate"],
      {
        name: "attendance_register_class_date_unique",
        unique: true,
        transaction,
      }
    );

    // Filter registers by school, session and term
    await queryInterface.addIndex(
      "AttendanceRegisters",
      ["schoolId", "sessionId", "termId"],
      {
        name: "attendance_register_school_session_term",
        transaction,
      }
    );
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("AttendanceRegisters", { transaction });

    await queryInterface.removeIndex(
      "Sessions",
      "sessions_school_id_id_unique",
      { transaction }
    );
  });
}
