import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  // 1. Create AssessmentConfigurations table.
  await queryInterface.createTable("AssessmentConfigurations", {
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

    educationSection: {
      type: DataTypes.ENUM(
        "EARLY_YEARS",
        "PRIMARY",
        "JUNIOR_SECONDARY",
        "SENIOR_SECONDARY"
      ),
      allowNull: false,
    },

    versionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "PENDING",
        "SUPERSEDED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    previousVersionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    effectiveFromTermId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    effectiveUntilTermId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
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

  // 2. Supporting composite unique index.
  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["schoolId", "id"],
    {
      unique: true,
      name: "assessment_config_school_id_id_unique",
    }
  );

  // 3. School ownership.
  await queryInterface.addConstraint(
    "AssessmentConfigurations",
    {
      fields: ["schoolId"],
      type: "foreign key",
      name: "assessment_config_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    }
  );

  // 4. Creator must belong to the same school.
  await queryInterface.addConstraint(
    "AssessmentConfigurations",
    {
      fields: ["schoolId", "createdBy"],
      type: "foreign key",
      name: "assessment_config_creator_same_school_fk",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // 5. Previous configuration must belong to the same school.
  await queryInterface.addConstraint(
    "AssessmentConfigurations",
    {
      fields: ["schoolId", "previousVersionId"],
      type: "foreign key",
      name: "assessment_config_previous_same_school_fk",
      references: {
        table: "AssessmentConfigurations",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // 6. Starting term must exist.
  await queryInterface.addConstraint(
    "AssessmentConfigurations",
    {
      fields: ["effectiveFromTermId"],
      type: "foreign key",
      name: "assessment_config_effective_from_term_fk",
      references: {
        table: "Terms",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // 7. Ending term must exist when provided.
  await queryInterface.addConstraint(
    "AssessmentConfigurations",
    {
      fields: ["effectiveUntilTermId"],
      type: "foreign key",
      name: "assessment_config_effective_until_term_fk",
      references: {
        table: "Terms",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // 8. Version number must be positive.
  await queryInterface.sequelize.query(`
    ALTER TABLE "AssessmentConfigurations"
    ADD CONSTRAINT "assessment_config_version_positive"
    CHECK ("versionNumber" >= 1);
  `);

  // 9. Only one ACTIVE configuration per school and section.
  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["schoolId", "educationSection"],
    {
      unique: true,
      name: "assessment_config_one_active_per_section",
      where: {
        status: "ACTIVE",
      },
    }
  );

  // 10. Prevent duplicate version numbers.
  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["schoolId", "educationSection", "versionNumber"],
    {
      unique: true,
      name: "assessment_config_school_section_version_unique",
    }
  );

  // 11. Support configuration lookups.
  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["schoolId", "educationSection", "status"],
    {
      name: "assessment_config_school_section_status",
    }
  );

  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["effectiveFromTermId"],
    {
      name: "assessment_config_effective_from_term",
    }
  );

  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["effectiveUntilTermId"],
    {
      name: "assessment_config_effective_until_term",
    }
  );

  await queryInterface.addIndex(
    "AssessmentConfigurations",
    ["previousVersionId"],
    {
      name: "assessment_config_previous_version",
    }
  );
}

export async function down({ context: queryInterface }) {
  // Drop the table and its constraints/indexes.
  await queryInterface.dropTable("AssessmentConfigurations");

  // Remove the PostgreSQL ENUM types.
  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS "enum_AssessmentConfigurations_educationSection";
  `);

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS "enum_AssessmentConfigurations_status";
  `);
}