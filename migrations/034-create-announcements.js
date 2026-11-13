import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "Announcements",
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
          references: {
            model: "Schools",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        createdBy: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        title: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },

        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        audience: {
          type: DataTypes.ENUM(
            "STAFF",
            "STUDENTS",
            "PARENTS",
            "SECURITY"
          ),
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

    // Ensure the announcement creator belongs to the same school.
    await dbConnection.query(
      `
        ALTER TABLE "Announcements"
        ADD CONSTRAINT "announcements_school_creator_fk"
        FOREIGN KEY ("schoolId", "createdBy")
        REFERENCES "Users" ("schoolId", "id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT
      `,
      { transaction }
    );

    // Title must contain at least 3 non-whitespace characters.
    await dbConnection.query(
      `
        ALTER TABLE "Announcements"
        ADD CONSTRAINT "announcements_title_check"
        CHECK (
          LENGTH(BTRIM("title")) >= 3
          AND LENGTH("title") <= 200
        )
      `,
      { transaction }
    );

    // Message must not be empty or contain only whitespace.
    await dbConnection.query(
      `
        ALTER TABLE "Announcements"
        ADD CONSTRAINT "announcements_message_check"
        CHECK (LENGTH(BTRIM("message")) > 0)
      `,
      { transaction }
    );

    await queryInterface.addIndex(
      "Announcements",
      ["schoolId", "createdAt"],
      {
        name: "announcements_school_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "Announcements",
      ["createdBy"],
      {
        name: "announcements_created_by_idx",
        transaction,
      }
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
    await queryInterface.dropTable("Announcements", { transaction });

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Announcements_audience"',
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}