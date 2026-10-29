import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Announcement = dbConnection.define(
    "Announcement",
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

        createdBy: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        // =====================================
        // ANNOUNCEMENT INFORMATION
        // =====================================

        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [3, 200],
            },
        },

        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },

        // =====================================
        // TARGET AUDIENCE
        // =====================================

        audience: {
            type: DataTypes.ENUM(
                "STAFF",
                "STUDENTS",
                "PARENTS",
                "SECURITY"
            ),
            allowNull: false,
        },
    },
    {
        tableName: "Announcements",
        timestamps: true,

        indexes: [
            {
                fields: ["schoolId", "createdAt"],
            },
            {
                fields: ["createdBy"],
            },
        ],
    }
);

export default Announcement;