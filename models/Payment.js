import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const Payment = dbConnection.define(
  "Payment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this payment
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Unique reference for this payment attempt
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    // Payment amount
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01,
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

    // Payment status
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

    // Payment provider
    provider: {
      type: DataTypes.ENUM("PAYSTACK"),
      allowNull: false,
      defaultValue: "PAYSTACK",
    },

    // Transaction ID returned by the payment provider
    providerTransactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Date payment was successfully completed
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Additional payment information
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "Payments",
    timestamps: true,

    indexes: [
      {
        name: "payments_reference_unique",
        unique: true,
        fields: ["reference"],
      },
      {
        name: "payments_school_created_at_idx",
        fields: ["schoolId", "createdAt"],
      },
    ],
  }
);

export default Payment;