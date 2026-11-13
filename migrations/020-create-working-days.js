import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "WorkingDays",
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

        days: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: dbConnection.literal(
            `'["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"]'::jsonb`
          ),
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

    // Each school can have only one working-day configuration.
    await queryInterface.addIndex("WorkingDays", ["schoolId"], {
      name: "working_days_school_id_unique",
      unique: true,
      transaction,
    });

    // Ensure the school exists.
    await queryInterface.addConstraint("WorkingDays", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "working_days_school_id_fkey",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Ensure days is a non-empty JSON array.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "WorkingDays"
        ADD CONSTRAINT "working_days_days_non_empty_array_check"
        CHECK (
          CASE
            WHEN jsonb_typeof("days") = 'array'
            THEN jsonb_array_length("days") > 0
            ELSE false
          END
        )
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
  await queryInterface.dropTable("WorkingDays");
}