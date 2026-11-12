import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      "Sessions",
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
          references: {
            model: "Schools",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        sessionName: {
          type: DataTypes.STRING(20),
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
      "Sessions",
      ["schoolId", "sessionName"],
      {
        unique: true,
        name: "sessions_school_id_session_name_unique",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "Sessions",
      ["schoolId"],
      {
        unique: true,
        name: "sessions_one_current_per_school",
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
    await queryInterface.dropTable("Sessions", { transaction });

    await queryInterface.dropEnum(
      "enum_Sessions_status",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}