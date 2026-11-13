
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "TimetablePeriods",
      {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: dbConnection.literal("gen_random_uuid()"),
        },

        schoolId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        name: {
          type: DataTypes.STRING(60),
          allowNull: false,
        },

        time: {
          type: DataTypes.STRING(80),
          allowNull: true,
        },

        orderIndex: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
        },

        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction }
    );

    // School foreign key
    await queryInterface.addConstraint("TimetablePeriods", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "timetable_periods_school_id_fkey",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Composite unique index for same-school references
    await queryInterface.addIndex(
      "TimetablePeriods",
      ["schoolId", "id"],
      {
        unique: true,
        name: "timetable_periods_school_id_id_unique",
        transaction,
      }
    );

    // Period names must be unique within a school
    await queryInterface.addIndex(
      "TimetablePeriods",
      ["schoolId", "name"],
      {
        unique: true,
        name: "unique_timetable_period_name_per_school",
        transaction,
      }
    );

    // Supports ordering periods within a school
    await queryInterface.addIndex(
      "TimetablePeriods",
      ["schoolId", "orderIndex"],
      {
        name: "idx_timetable_period_school_order",
        transaction,
      }
    );

    // Period name cannot contain only whitespace
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "TimetablePeriods"
        ADD CONSTRAINT "timetable_periods_name_not_empty_check"
        CHECK (length(btrim("name")) >= 1);
      `,
      { transaction }
    );

    // Period order cannot be negative
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "TimetablePeriods"
        ADD CONSTRAINT "timetable_periods_order_non_negative_check"
        CHECK ("orderIndex" >= 0);
      `,
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.dropTable(
      "TimetablePeriods",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
