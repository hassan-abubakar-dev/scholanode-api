
/**
 * @file dbConnection.js
 * @description Centralized PostgreSQL database configuration.
 * Supports local development using individual environment variables
 * and production using a PostgreSQL connection URL.
 */

import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

let dbConnection;

if (isProduction) {
  // Production: Supabase PostgreSQL connection URL
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "FATAL: DATABASE_URL is missing from production environment."
    );
  }

  dbConnection = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",

    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },

    logging: false,

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
} else {
  // Local development: individual database environment variables
  const required = [
    "DATABASE_NAME",
    "DATABASE_USERNAME",
    "DATABASE_PASSWORD",
    "DATABASE_HOST",
  ];

  required.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(
        `FATAL: Missing ${key} in environment configuration.`
      );
    }
  });

  dbConnection = new Sequelize(
    process.env.DATABASE_NAME,
    process.env.DATABASE_USERNAME,
    process.env.DATABASE_PASSWORD,
    {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT || 5432),
      dialect: "postgres",
      logging: false,

      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

export { dbConnection };

/**
 * Tests the database connection.
 */
export const testConnection = async () => {
  try {
    await dbConnection.authenticate();
    console.log("Database connection successful");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
};
