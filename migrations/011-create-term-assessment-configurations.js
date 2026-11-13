import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  // Create the table
  await queryInterface.createTable("TermAssessmentConfigurations", {
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

    termId: {
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

    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    assignedBy: {
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

  // School relationship
  await queryInterface.addConstraint(
    "TermAssessmentConfigurations",
    {
      fields: ["schoolId"],
      type: "foreign key",
      name: "term_assessment_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    }
  );

  // Term relationship
  await queryInterface.addConstraint(
    "TermAssessmentConfigurations",
    {
      fields: ["termId"],
      type: "foreign key",
      name: "term_assessment_term_fk",
      references: {
        table: "Terms",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // Assessment configuration must belong to the same school
  await queryInterface.addConstraint(
    "TermAssessmentConfigurations",
    {
      fields: ["schoolId", "assessmentConfigurationId"],
      type: "foreign key",
      name: "term_assessment_configuration_same_school_fk",
      references: {
        table: "AssessmentConfigurations",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // The assigning user must belong to the same school
  await queryInterface.addConstraint(
    "TermAssessmentConfigurations",
    {
      fields: ["schoolId", "assignedBy"],
      type: "foreign key",
      name: "term_assessment_assigned_by_same_school_fk",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    }
  );

  // Prevent duplicate section assignments within the same term
  await queryInterface.addIndex(
    "TermAssessmentConfigurations",
    ["termId", "educationSection"],
    {
      unique: true,
      name: "term_assessment_section_unique",
    }
  );


  // School-scoped configuration lookup index
  await queryInterface.addIndex(
    "TermAssessmentConfigurations",
    ["schoolId", "assessmentConfigurationId"],
    {
      name: "term_assessment_configuration_index",
    }
  );

  // School-scoped assigning user lookup index
  await queryInterface.addIndex(
    "TermAssessmentConfigurations",
    ["schoolId", "assignedBy"],
    {
      name: "term_assessment_assigned_by_index",
    }
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("TermAssessmentConfigurations");

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS "enum_TermAssessmentConfigurations_educationSection";
  `);
}