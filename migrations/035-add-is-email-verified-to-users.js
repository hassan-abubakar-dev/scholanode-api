import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn("Users", "isEmailVerified", {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn("Users", "isEmailVerified");
}