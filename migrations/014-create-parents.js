
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      "Parents",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
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

        status: {
          type: DataTypes.ENUM(
            "ACTIVE",
            "INACTIVE",
            "SUSPENDED"
          ),
          allowNull: false,
          defaultValue: "ACTIVE",
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

    // Parent must belong to an existing school.
    await queryInterface.addConstraint("Parents", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "parent_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Parent's user account must belong to the same school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "Parents"
      ADD CONSTRAINT "parent_user_same_school_fk"
      FOREIGN KEY ("schoolId", "userId")
      REFERENCES "Users" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `, { transaction });

    // Unique parent account within each school.
    await queryInterface.addIndex(
      "Parents",
      ["schoolId", "userId"],
      {
        unique: true,
        name: "parents_school_id_user_id_unique",
        transaction,
      }
    );

    // Supports composite foreign keys referencing Parents.
    await queryInterface.addIndex(
      "Parents",
      ["schoolId", "id"],
      {
        unique: true,
        name: "parents_school_id_id_unique",
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
  await queryInterface.dropTable("Parents");

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS "enum_Parents_status";
  `);
}
