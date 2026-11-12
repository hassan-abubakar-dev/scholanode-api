/**
 * @file dbConnection.js
 * @description Centralized database configuration and connectivity service.
 * This module initializes the Sequelize instance for MySQL and provides 
 * validation to ensure the application environment is correctly configured.
 */

import { Sequelize } from "sequelize";
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate that all required environment variables are present.
 * If any are missing, the application will throw an error and terminate immediately.
 * This meets the "fatal error on startup" requirement for the assignment.
 */
const required = ['DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD', 'DATABASE_HOST'];
required.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`FATAL: Missing ${key} in environment configuration. Application cannot start.`);
  }
});

/**
 * Sequelize database instance configured for MySQL.
 * Uses a connection pool to manage multiple simultaneous database operations efficiently.
 * @type {Sequelize}
 */
export const dbConnection = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USERNAME,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    dialect: process.env.DATABASE_DIALECT || "postgres",
    logging: false,

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

/**
 * Tests the database connection by authenticating the credentials.
 * If the connection fails, it logs the error and stops the process to prevent 
 * the application from running in a broken state.
 * @async
 * @returns {Promise<void>}
 */
export const testConnection = async () => {
  try {
    await dbConnection.authenticate();
    console.log('Database connection successful');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1); // Exit process with failure code
  }
};