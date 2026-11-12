
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("Users", {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.literal("gen_random_uuid()"),
      primaryKey: true,
      allowNull: false,
    },

    // School relationship
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

    // Basic information
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    surName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    // Login information
    loginId: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    profileCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    role: {
      type: DataTypes.ENUM(
        "LEADER",
        "VICE_LEADER",
        "ADMINISTRATOR",
        "EXAM_OFFICER",
        "STAFF",
        "PARENT",
        "STUDENT",
        "SECURITY"
      ),
      allowNull: false,
    },

    // Optional profile information
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    profileImageKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // System information
    status: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "INACTIVE",
        "SUSPENDED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    lastNotificationCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },

    // Sequelize timestamps
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // A login ID must be unique within its school.
  await queryInterface.addIndex("Users", ["schoolId", "loginId"], {
    unique: true,
    name: "users_school_id_login_id_unique",
  });

  // Ensures (schoolId, id) can be referenced by a composite foreign key.
  await queryInterface.addIndex("Users", ["schoolId", "id"], {
    unique: true,
    name: "users_school_id_id_unique",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("Users");
}
