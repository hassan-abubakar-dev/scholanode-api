import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "SchoolInquiries",
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

        fullName: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },

        contact: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },

        subject: {
          type: DataTypes.STRING(150),
          allowNull: false,
        },

        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM("NEW", "REVIEWED"),
          allowNull: false,
          defaultValue: "NEW",
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

    // Full name: 2–100 characters, excluding surrounding whitespace.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "SchoolInquiries"
        ADD CONSTRAINT "school_inquiries_full_name_check"
        CHECK (
          LENGTH(BTRIM("fullName")) >= 2
          AND LENGTH("fullName") <= 100
        );
      `,
      { transaction }
    );

    // Contact must not be empty or whitespace-only.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "SchoolInquiries"
        ADD CONSTRAINT "school_inquiries_contact_check"
        CHECK (LENGTH(BTRIM("contact")) > 0);
      `,
      { transaction }
    );

    // Subject: 3–150 characters.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "SchoolInquiries"
        ADD CONSTRAINT "school_inquiries_subject_check"
        CHECK (
          LENGTH(BTRIM("subject")) >= 3
          AND LENGTH("subject") <= 150
        );
      `,
      { transaction }
    );

    // Message: 10–5000 characters.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "SchoolInquiries"
        ADD CONSTRAINT "school_inquiries_message_check"
        CHECK (
          LENGTH(BTRIM("message")) >= 10
          AND LENGTH("message") <= 5000
        );
      `,
      { transaction }
    );

    await queryInterface.addIndex(
      "SchoolInquiries",
      ["schoolId", "status", "createdAt"],
      {
        name: "school_inquiries_school_status_created_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "SchoolInquiries",
      ["schoolId", "createdAt"],
      {
        name: "school_inquiries_school_created_idx",
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
    await queryInterface.dropTable(
      "SchoolInquiries",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_SchoolInquiries_status",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}