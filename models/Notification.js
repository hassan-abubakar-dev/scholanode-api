import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Notification = dbConnection.define(
    "Notification",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        // =====================================
        // SCHOOL
        // =====================================

        schoolId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        // =====================================
        // NOTIFICATION DELIVERY
        // =====================================

        deliveryType: {
            type: DataTypes.ENUM("SHARED", "INDIVIDUAL"),
            allowNull: false,
        },

        recipientUserId: {
            type: DataTypes.UUID,
            allowNull: true,
        },

        // JSONB array: ["STAFF", "STUDENTS", "PARENTS"]
        audience: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
            validate: {
                isValidAudience(value) {
                    if (value == null) return;

                    const allowedAudiences = [
                        "STAFF",
                        "STUDENTS",
                        "PARENTS",
                        "SECURITY",
                    ];

                    if (
                        !Array.isArray(value) ||
                        value.length === 0 ||
                        value.some(
                            (role) => !allowedAudiences.includes(role)
                        ) ||
                        new Set(value).size !== value.length
                    ) {
                        throw new Error(
                            "Audience must contain valid, unique roles."
                        );
                    }
                },
            },
        },

        // =====================================
        // NOTIFICATION CONTENT
        // =====================================

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

        // =====================================
        // RELATED RECORD
        // =====================================

        // Optional reference to a related record.
        // This is intentionally not a foreign key.
        referenceId: {
            type: DataTypes.UUID,
            allowNull: true,
        },

        // =====================================
        // ADDITIONAL DATA
        // =====================================

        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    },
    {
        tableName: "Notifications",
        timestamps: true,

        indexes: [
            {
                fields: ["schoolId", "createdAt"],
                name: "notifications_school_created_at_idx",
            },
            {
                fields: ["recipientUserId", "createdAt"],
                name: "notifications_recipient_created_at_idx",
            },
            {
                fields: ["type"],
                name: "notifications_type_idx",
            },
        ],

        validate: {
            validDeliveryTarget() {
                if (this.deliveryType === "SHARED") {
                    if (this.recipientUserId != null) {
                        throw new Error(
                            "Shared notifications cannot have a specific recipient."
                        );
                    }

                    if (
                        !Array.isArray(this.audience) ||
                        this.audience.length === 0
                    ) {
                        throw new Error(
                            "Shared notifications must have at least one audience."
                        );
                    }
                }

                if (this.deliveryType === "INDIVIDUAL") {
                    if (!this.recipientUserId) {
                        throw new Error(
                            "Individual notifications require a recipient."
                        );
                    }

                    if (this.audience != null) {
                        throw new Error(
                            "Individual notifications cannot have a shared audience."
                        );
                    }
                }

                if (
                    this.deliveryType !== "SHARED" &&
                    this.deliveryType !== "INDIVIDUAL"
                ) {
                    throw new Error(
                        "Invalid notification delivery type."
                    );
                }
            },
        },
    }
);

export default Notification;