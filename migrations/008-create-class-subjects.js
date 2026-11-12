import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  // 1. Add the composite unique index required by
  // the ClassSubjects -> Subjects composite foreign key.
  await queryInterface.addIndex(
    "Subjects",
    ["schoolId", "id"],
    {
      unique: true,
      name: "subjects_school_id_id_unique",
    }
  );

  // 2. Create the ClassSubjects table.
  await queryInterface.createTable("ClassSubjects", {
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

    classId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    subjectId: {
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

  // 3. Ensure the school exists.
  await queryInterface.addConstraint("ClassSubjects", {
    fields: ["schoolId"],
    type: "foreign key",
    name: "class_subjects_school_fk",
    references: {
      table: "Schools",
      field: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });

  // 4. Ensure the class belongs to the recorded school.
  await queryInterface.addConstraint("ClassSubjects", {
    fields: ["schoolId", "classId"],
    type: "foreign key",
    name: "class_subjects_class_same_school_fk",
    references: {
      table: "Classes",
      fields: ["schoolId", "id"],
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });

  // 5. Ensure the subject belongs to the recorded school.
  await queryInterface.addConstraint("ClassSubjects", {
    fields: ["schoolId", "subjectId"],
    type: "foreign key",
    name: "class_subjects_subject_same_school_fk",
    references: {
      table: "Subjects",
      fields: ["schoolId", "id"],
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });

  // 6. Prevent duplicate subject assignments to a class.
  await queryInterface.addIndex(
    "ClassSubjects",
    ["schoolId", "classId", "subjectId"],
    {
      unique: true,
      name: "class_subject_unique",
    }
  );

  // 7. Support class-based lookups.
  await queryInterface.addIndex(
    "ClassSubjects",
    ["schoolId", "classId"],
    {
      name: "class_subject_class_index",
    }
  );

  // 8. Support subject-based lookups.
  await queryInterface.addIndex(
    "ClassSubjects",
    ["schoolId", "subjectId"],
    {
      name: "class_subject_subject_index",
    }
  );
}

export async function down({ context: queryInterface }) {
  // Remove the junction table and its constraints/indexes.
  await queryInterface.dropTable("ClassSubjects");

  // Remove the supporting index added to Subjects.
  await queryInterface.removeIndex(
    "Subjects",
    "subjects_school_id_id_unique"
  );
}