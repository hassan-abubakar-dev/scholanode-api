
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("Schools", {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.literal("gen_random_uuid()"),
      primaryKey: true,
      allowNull: false,
    },

    schoolName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    schoolCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    schoolLevel: {
      type: DataTypes.ENUM("PRIMARY", "SECONDARY", "COMBINED"),
      allowNull: false,
    },

    ownershipType: {
      type: DataTypes.ENUM("GOVERNMENT", "PRIVATE"),
      allowNull: false,
    },

    selectedPlan: {
      type: DataTypes.ENUM(
        "FREE",
        "STARTER",
        "STANDARD",
        "PROFESSIONAL"
      ),
      allowNull: true,
    },

    selectedTierId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    selectedBillingCycle: {
      type: DataTypes.ENUM("MONTHLY", "TERMLY", "YEARLY"),
      allowNull: true,
    },

    supportEmail: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    supportPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    logoKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "PENDING_VERIFICATION",
        "PENDING_ACTIVATION",
        "ACTIVE",
        "SUSPENDED"
      ),
      allowNull: false,
      defaultValue: "PENDING_VERIFICATION",
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex("Schools", ["schoolCode"], {
    unique: true,
    name: "schools_school_code_unique",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("Schools");
}
