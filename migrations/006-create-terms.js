import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      "Terms",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
          primaryKey: true,
          allowNull: false,
        },

        sessionId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: "Sessions",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        termName: {
          type: DataTypes.ENUM(
            "FIRST_TERM",
            "SECOND_TERM",
            "THIRD_TERM"
          ),
          allowNull: false,
        },

        startDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },

        endDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM(
            "UPCOMING",
            "ACTIVE",
            "COMPLETED"
          ),
          allowNull: false,
          defaultValue: "UPCOMING",
        },

        isCurrent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
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

    await queryInterface.addIndex(
      "Terms",
      ["sessionId", "termName"],
      {
        unique: true,
        name: "terms_session_id_term_name_unique",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "Terms",
      ["sessionId"],
      {
        unique: true,
        name: "terms_one_current_per_session",
        where: {
          isCurrent: true,
        },
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
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.dropTable("Terms", { transaction });

    await queryInterface.dropEnum(
      "enum_Terms_termName",
      { transaction }
    );

    await queryInterface.dropEnum(
      "enum_Terms_status",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}