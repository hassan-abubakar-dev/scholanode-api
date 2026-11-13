import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "PlatformContactInquiries",
      {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: dbConnection.literal("gen_random_uuid()"),
        },

        fullName: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },

        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },

        category: {
          type: DataTypes.ENUM(
            "SCHOOL_REGISTRATION",
            "ACCOUNT_ACTIVATION",
            "SUBSCRIPTION_AND_BILLING",
            "TECHNICAL_SUPPORT",
            "PARTNERSHIP",
            "GENERAL_INQUIRY",
            "OTHER"
          ),
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

        allowEmailReply: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        status: {
          type: DataTypes.ENUM(
            "NEW",
            "REVIEWED",
            "REPLIED",
            "CLOSED"
          ),
          allowNull: false,
          defaultValue: "NEW",
        },

        reviewedByPlatformUserId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: "PlatformUsers",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },

        reviewedAt: {
          type: DataTypes.DATE,
          allowNull: true,
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

    // Prevent empty or whitespace-only visitor names.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "PlatformContactInquiries"
        ADD CONSTRAINT "platform_contact_inquiries_full_name_check"
        CHECK (LENGTH(BTRIM("fullName")) > 0);
      `,
      { transaction }
    );

    // Prevent empty or whitespace-only subjects.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "PlatformContactInquiries"
        ADD CONSTRAINT "platform_contact_inquiries_subject_check"
        CHECK (LENGTH(BTRIM("subject")) > 0);
      `,
      { transaction }
    );

    // Prevent empty or whitespace-only messages.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "PlatformContactInquiries"
        ADD CONSTRAINT "platform_contact_inquiries_message_check"
        CHECK (LENGTH(BTRIM("message")) > 0);
      `,
      { transaction }
    );

    // Find inquiries by status and creation date.
    await queryInterface.addIndex(
      "PlatformContactInquiries",
      ["status", "createdAt"],
      {
        name: "platform_contact_inquiries_status_created_at_idx",
        transaction,
      }
    );

    // Find inquiries by category and creation date.
    await queryInterface.addIndex(
      "PlatformContactInquiries",
      ["category", "createdAt"],
      {
        name: "platform_contact_inquiries_category_created_at_idx",
        transaction,
      }
    );

    // Find inquiries assigned to a platform team member by status.
    await queryInterface.addIndex(
      "PlatformContactInquiries",
      ["reviewedByPlatformUserId", "status"],
      {
        name: "platform_contact_inquiries_reviewer_status_idx",
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
      "PlatformContactInquiries",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_PlatformContactInquiries_category",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_PlatformContactInquiries_status",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}