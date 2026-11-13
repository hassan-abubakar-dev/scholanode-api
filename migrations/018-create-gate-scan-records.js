
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    // Create GateScanRecords table
    await queryInterface.createTable(
      "GateScanRecords",
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

        studentId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        scannedByUserId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        scanType: {
          type: DataTypes.ENUM("ARRIVAL", "RETURN"),
          allowNull: false,
        },

        scannedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
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
    await queryInterface.addConstraint("GateScanRecords", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "gate_scan_records_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      transaction,
    });

    // Student foreign key: enforce same-school ownership
    await queryInterface.addConstraint("GateScanRecords", {
      fields: ["schoolId", "studentId"],
      type: "foreign key",
      name: "gate_scan_records_student_school_fk",
      references: {
        table: "Students",
        fields: ["schoolId", "id"],
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      transaction,
    });

    // Scanner foreign key: enforce same-school ownership
    await queryInterface.addConstraint("GateScanRecords", {
      fields: ["schoolId", "scannedByUserId"],
      type: "foreign key",
      name: "gate_scan_records_scanner_school_fk",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      transaction,
    });

    // Student scan history index
    await queryInterface.addIndex(
      "GateScanRecords",
      ["schoolId", "studentId", "scannedAt"],
      {
        name: "gate_scan_records_school_student_scanned_at_idx",
        transaction,
      }
    );

    // Scan date and type index
    await queryInterface.addIndex(
      "GateScanRecords",
      ["schoolId", "scanType", "scannedAt"],
      {
        name: "gate_scan_records_school_type_scanned_at_idx",
        transaction,
      }
    );

    // Staff scanner history index
    await queryInterface.addIndex(
      "GateScanRecords",
      ["schoolId", "scannedByUserId", "scannedAt"],
      {
        name: "gate_scan_records_school_scanner_scanned_at_idx",
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
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.dropTable("GateScanRecords", { transaction });

    // Remove PostgreSQL ENUM type
    await queryInterface.dropEnum(
      "enum_GateScanRecords_scanType",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
