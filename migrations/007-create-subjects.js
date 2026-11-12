import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      "Subjects",
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

        subjectName: {
          type: DataTypes.STRING(100),
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
        },

        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      { transaction }
    );

    await queryInterface.addIndex(
      "Subjects",
      ["schoolId", "subjectName"],
      {
        unique: true,
        name: "subjects_school_id_subject_name_unique",
        transaction,
      }
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE "Subjects"
       ADD CONSTRAINT "subjects_subject_name_not_empty"
       CHECK (BTRIM("subjectName") <> '');`,
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("Subjects");
}