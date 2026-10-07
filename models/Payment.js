import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { dbConnection } from "../config/db.js";

dotenv.config();

const Payment = dbConnection.define(
  "Payment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ===============================
    // PAYMENT OWNER
    // ===============================

    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // ===============================
    // PAYMENT DETAILS
    // ===============================

    reference: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },

    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      validate: {
        notEmpty: true,
      },
    },

    // ===============================
    // PAYMENT STATUS
    // ===============================

    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "PROCESSING",
        "SUCCESSFUL",
        "FAILED",
        "CANCELLED"
      ),
      allowNull: false,
      defaultValue: "PENDING",
    },

    // ===============================
    // PAYMENT PROVIDER
    // ===============================

    provider: {
      type: DataTypes.ENUM("PAYSTACK"),
      allowNull: false,
      defaultValue: "PAYSTACK",
    },

    providerTransactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // ===============================
    // PAYMENT COMPLETION
    // ===============================

    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // ===============================
    // ADDITIONAL PAYMENT INFORMATION
    // ===============================

    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "Payments",
    timestamps: true,
  }
);

export default Payment;