
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "GateScanners",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: dbConnection.literal("gen_random_uuid()"),
          primaryKey: true,
          allowNull: false,
        },

        schoolId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        userId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    await queryInterface.addConstraint("GateScanners", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "gate_scanners_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      transaction,
    });

    // User foreign key: enforce same-school ownership
    await queryInterface.addConstraint("GateScanners", {
      fields: ["schoolId", "userId"],
      type: "foreign key",
      name: "gate_scanners_user_school_fk",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      transaction,
    });

    // One permission record per user per school
    await queryInterface.addIndex(
      "GateScanners",
      ["schoolId", "userId"],
      {
        unique: true,
        name: "gate_scanners_school_user_unique",
        transaction,
      }
    );

    // Quickly retrieve active scanners for a school
    await queryInterface.addIndex(
      "GateScanners",
      ["schoolId", "isActive"],
      {
        name: "gate_scanners_school_active_idx",
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
  await queryInterface.dropTable("GateScanners");
}
