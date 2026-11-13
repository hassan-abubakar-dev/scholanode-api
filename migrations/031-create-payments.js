import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "Payments",
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

        reference: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },

        currency: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "NGN",
        },

        status: {
          type: DataTypes.ENUM(
            "PENDING",
            "PROCESSING",
            "SUCCESSFUL",
            "FAILED",
            "CANCELLED"
          ),
          allowNull: false,
          defaultValue: "PENDING",
        },

        provider: {
          type: DataTypes.ENUM("PAYSTACK"),
          allowNull: false,
          defaultValue: "PAYSTACK",
        },

        providerTransactionId: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        paidAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        metadata: {
          type: DataTypes.JSONB,
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

    // Each payment reference must be unique.
    await queryInterface.addIndex(
      "Payments",
      ["reference"],
      {
        name: "payments_reference_unique",
        unique: true,
        transaction,
      }
    );

    // Helps retrieve a school's payment history by creation date.
    await queryInterface.addIndex(
      "Payments",
      ["schoolId", "createdAt"],
      {
        name: "payments_school_created_at_idx",
        transaction,
      }
    );

    // Payment amounts must be greater than zero.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "Payments"
        ADD CONSTRAINT "payments_amount_positive_check"
        CHECK ("amount" > 0);
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
      "Payments",
      { transaction }
    );

    // Remove PostgreSQL ENUM types created for this table.
    await queryInterface.dropEnum(
      "enum_Payments_status",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_Payments_provider",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}