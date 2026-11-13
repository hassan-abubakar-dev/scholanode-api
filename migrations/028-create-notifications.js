import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
    const transaction = await dbConnection.transaction();

    try {
        // =====================================
        // CREATE TABLE
        // =====================================

        await queryInterface.createTable(
            "Notifications",
            {
                id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    primaryKey: true,
                    defaultValue: dbConnection.literal("gen_random_uuid()"),
                },

                schoolId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                },

                deliveryType: {
                    type: DataTypes.ENUM("SHARED", "INDIVIDUAL"),
                    allowNull: false,
                },

                recipientUserId: {
                    type: DataTypes.UUID,
                    allowNull: true,
                    defaultValue: null,
                },

                audience: {
                    type: DataTypes.JSONB,
                    allowNull: true,
                    defaultValue: null,
                },

                type: {
                    type: DataTypes.ENUM(
                        "ANNOUNCEMENT",
                        "COMPLAINT_RESOLVED",
                        "GATE_ARRIVAL",
                        "GATE_RETURN",
                        "HELP_SUPPORT_REPLY",
                        "GENERAL"
                    ),
                    allowNull: false,
                },

                title: {
                    type: DataTypes.STRING(200),
                    allowNull: false,
                },

                message: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                },

                referenceId: {
                    type: DataTypes.UUID,
                    allowNull: true,
                },

                metadata: {
                    type: DataTypes.JSONB,
                    allowNull: true,
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

        // =====================================
        // FOREIGN KEYS
        // =====================================

        // School ownership
        await queryInterface.addConstraint("Notifications", {
            fields: ["schoolId"],
            type: "foreign key",
            name: "notifications_school_id_fkey",
            references: {
                table: "Schools",
                field: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
            transaction,
        });

        // Recipient must belong to the same school.
        // RESTRICT prevents deleting a user who still has
        // individual notifications referencing them.
        await queryInterface.addConstraint("Notifications", {
            fields: ["schoolId", "recipientUserId"],
            type: "foreign key",
            name: "notifications_school_recipient_fkey",
            references: {
                table: "Users",
                fields: ["schoolId", "id"],
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
            transaction,
        });

        // =====================================
        // CHECK CONSTRAINTS
        // =====================================

        // A shared notification must have an audience
        // and must not have a specific recipient.
        //
        // An individual notification must have a recipient
        // and must not have an audience.
        await queryInterface.sequelize.query(
            `
            ALTER TABLE "Notifications"
            ADD CONSTRAINT "notifications_delivery_target_check"
            CHECK (
                (
                    "deliveryType" = 'SHARED'
                    AND "recipientUserId" IS NULL
                    AND "audience" IS NOT NULL
                )
                OR
                (
                    "deliveryType" = 'INDIVIDUAL'
                    AND "recipientUserId" IS NOT NULL
                    AND "audience" IS NULL
                )
            );
            `,
            { transaction }
        );

        // Audience must be a non-empty JSONB array
        // containing only the allowed audience values.
        await queryInterface.sequelize.query(
            `
            ALTER TABLE "Notifications"
            ADD CONSTRAINT "notifications_audience_check"
            CHECK (
                CASE
                    WHEN "audience" IS NULL THEN TRUE

                    WHEN jsonb_typeof("audience") = 'array' THEN
                        jsonb_array_length("audience") > 0
                        AND "audience" <@ '[
                            "STAFF",
                            "STUDENTS",
                            "PARENTS",
                            "SECURITY"
                        ]'::jsonb

                    ELSE FALSE
                END
            );
            `,
            { transaction }
        );

        // =====================================
        // INDEXES
        // =====================================

        await queryInterface.addIndex(
            "Notifications",
            ["schoolId", "createdAt"],
            {
                name: "notifications_school_created_at_idx",
                transaction,
            }
        );

        await queryInterface.addIndex(
            "Notifications",
            ["recipientUserId", "createdAt"],
            {
                name: "notifications_recipient_created_at_idx",
                transaction,
            }
        );

        await queryInterface.addIndex(
            "Notifications",
            ["type"],
            {
                name: "notifications_type_idx",
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
        // Dropping the table also removes its constraints and indexes.
        await queryInterface.dropTable("Notifications", {
            transaction,
        });

        // Remove the PostgreSQL ENUM types created for this table.
        await queryInterface.sequelize.query(
            `
            DROP TYPE IF EXISTS "enum_Notifications_deliveryType";
            DROP TYPE IF EXISTS "enum_Notifications_type";
            `,
            { transaction }
        );

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}