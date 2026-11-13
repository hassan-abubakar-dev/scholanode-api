import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  // 1. Create AssessmentComponents table.
  await queryInterface.createTable("AssessmentComponents", {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.literal("gen_random_uuid()"),
      primaryKey: true,
      allowNull: false,
    },

    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    componentName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    maximumMark: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
    },

    weightPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },

    displayOrder: {
      type: DataTypes.INTEGER,
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

  // 2. Configuration relationship.
  await queryInterface.addConstraint("AssessmentComponents", {
    fields: ["assessmentConfigurationId"],
    type: "foreign key",
    name: "assessment_component_configuration_fk",
    references: {
      table: "AssessmentConfigurations",
      field: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });

  // 3. Component name must contain at least two non-whitespace characters.
  await queryInterface.sequelize.query(`
    ALTER TABLE "AssessmentComponents"
    ADD CONSTRAINT "assessment_component_name_length_check"
    CHECK (CHAR_LENGTH(BTRIM("componentName")) >= 2);
  `);

  // 4. Maximum mark must be greater than zero.
  await queryInterface.sequelize.query(`
    ALTER TABLE "AssessmentComponents"
    ADD CONSTRAINT "assessment_component_maximum_mark_check"
    CHECK ("maximumMark" > 0);
  `);

  // 5. Weight must be greater than zero and cannot exceed 100.
  await queryInterface.sequelize.query(`
    ALTER TABLE "AssessmentComponents"
    ADD CONSTRAINT "assessment_component_weight_check"
    CHECK ("weightPercentage" > 0 AND "weightPercentage" <= 100);
  `);

  // 6. Display order must start from 1.
  await queryInterface.sequelize.query(`
    ALTER TABLE "AssessmentComponents"
    ADD CONSTRAINT "assessment_component_display_order_check"
    CHECK ("displayOrder" >= 1);
  `);

  // 7. Prevent duplicate display positions within a configuration.
  await queryInterface.addIndex(
    "AssessmentComponents",
    ["assessmentConfigurationId", "displayOrder"],
    {
      unique: true,
      name: "assessment_component_config_order_unique",
    }
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("AssessmentComponents");
}