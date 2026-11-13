import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "SubscriptionPlans",
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

        plan: {
          type: DataTypes.ENUM(
            "FREE",
            "STARTER",
            "STANDARD",
            "PROFESSIONAL"
          ),
          allowNull: false,
          defaultValue: "FREE",
        },

        tierId: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },

        billingCycle: {
          type: DataTypes.ENUM(
            "MONTHLY",
            "TERMLY",
            "YEARLY"
          ),
          allowNull: true,
        },

        maxStudents: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },

        status: {
          type: DataTypes.ENUM(
            "TRIAL",
            "ACTIVE",
            "EXPIRED",
            "SUSPENDED"
          ),
          allowNull: false,
          defaultValue: "ACTIVE",
        },

        isAutoRenew: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        trialEndsAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        subscriptionEndsAt: {
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

    // Ensure each school has only one subscription record.
    await queryInterface.addIndex(
      "SubscriptionPlans",
      ["schoolId"],
      {
        name: "subscription_plans_school_id_unique",
        unique: true,
        transaction,
      }
    );

    // NULL means unlimited students.
    // Otherwise, maxStudents must be at least 1.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "SubscriptionPlans"
        ADD CONSTRAINT "subscription_plans_max_students_check"
        CHECK (
          "maxStudents" IS NULL OR "maxStudents" >= 1
        );
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
      "SubscriptionPlans",
      { transaction }
    );

    // Remove PostgreSQL ENUM types created for this table.
    await queryInterface.dropEnum(
      "enum_SubscriptionPlans_plan",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_SubscriptionPlans_billingCycle",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_SubscriptionPlans_status",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}