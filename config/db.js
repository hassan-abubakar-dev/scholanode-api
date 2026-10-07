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
    dialect: process.env.DATABASE_DIALECT || 'mysql',
    logging: false, // Set to false to reduce console clutter during development/demo
    pool: {
      max: 5,     // Maximum number of connections in pool
      min: 0,     // Minimum number of connections
      acquire: 30000, // Max time (ms) to wait for connection
      idle: 10000 // Max time (ms) a connection can be idle before release
    }
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