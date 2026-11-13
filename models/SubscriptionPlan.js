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

    // Specific pricing tier for paid plans
    tierId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Billing cycle for paid plans
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
    status: {
      type: DataTypes.ENUM(
        "TRIAL",
        "ACTIVE",
        "EXPIRED",
        "SUSPENDED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    // Whether the subscription should renew automatically
    isAutoRenew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Date a genuine trial period expires
    trialEndsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Date the current subscription expires.
    // This also stores the 120-day expiry for the FREE plan.
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
        name: "subscription_plans_school_id_unique",
        unique: true,
        fields: ["schoolId"],
      },
    ],
  }
);

export default SubscriptionPlan;