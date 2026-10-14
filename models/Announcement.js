import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Announcement = dbConnection.define(
    "Announcement",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        schoolId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        createdBy: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        // ===============================
        // ANNOUNCEMENT INFORMATION
        // ===============================

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

        // ===============================
        // TARGET AUDIENCE
        // ===============================

        audience: {
            type: DataTypes.ARRAY(
                DataTypes.ENUM(
                    "STAFF",
                    "STUDENTS",
                    "PARENTS"
                )
            ),
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },
    },
    {
        tableName: "Announcements",
        timestamps: true,

        indexes: [
            {
                fields: ["schoolId"],
            },
            {
                fields: ["createdBy"],
            },
            {
                fields: ["createdAt"],
            },
        ],
    }
);

export default Announcement;