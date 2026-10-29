import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const VerificationCode = dbConnection.define(
    "VerificationCode",
    {
        code: {
            type: DataTypes.STRING(6),
            allowNull: false,
        },

        expiryTime: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },

        userEmail: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },

        // Null remains valid for existing password-recovery records.
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
        },

        purpose: {
            type: DataTypes.ENUM(
                "PASSWORD_RESET",
                "PROFILE_EMAIL_CHANGE",
                "SCHOOL_REGISTRATION"
            ),
            allowNull: false,
            defaultValue: "PASSWORD_RESET",
        },
    },
    {
        tableName: "verificationCodes",
        timestamps: true,
        underscored: true,
    }
);

export default VerificationCode;