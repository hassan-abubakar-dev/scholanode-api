import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const SubscriptionPlan = dbConnection.define(
  "SubscriptionPlan",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // School that owns this subscription
    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Subscription plan
    // STARTER
    // STANDARD
    plan: {
      type: DataTypes.ENUM(
        "FREE",
        "STARTER",
        "STANDARD",
        "PROFESSIONAL"
      ),
      allowNull: false,
      defaultValue: "FREE",
    },

    tierId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Billing cycle
    // MONTHLY
    // TERMLY
    // YEARLY
    billingCycle: {
      type: DataTypes.ENUM(
        "MONTHLY",
        "TERMLY",
        "YEARLY"
      ),
      allowNull: true,
    },

    // Maximum number of students allowed.
    // NULL means unlimited.
    maxStudents: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
      },
    },

    // Current subscription status
    // TRIAL
    // ACTIVE
    // EXPIRED
    // SUSPENDED
    status: {
      type: DataTypes.ENUM(
        "TRIAL",
        "ACTIVE",
        "EXPIRED",
        "SUSPENDED"
      ),
      allowNull: false,
      defaultValue: "TRIAL",
    },

    // Whether the subscription should renew automatically
    isAutoRenew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Date the free trial expires
    trialEndsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Date the paid subscription expires
    subscriptionEndsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "SubscriptionPlans",
    timestamps: true,

      indexes: [
    {
      unique: true,
      fields: ["schoolId"],
    },
  ],
  }
);

export default SubscriptionPlan;