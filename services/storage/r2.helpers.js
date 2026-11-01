import { randomUUID } from "crypto";
import path from "path";

/**
 * Generate a unique object key for R2 storage.
 *
 * @param {string} folder - Storage folder
 * @param {string} originalName - Original uploaded filename
 * @returns {string} Unique object key
 */
export const generateR2Key = (folder, originalName) => {
  const extension = path.extname(originalName || "").toLowerCase();

  const safeFolder = folder
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "");

  return `${safeFolder}/${randomUUID()}${extension}`;
};

/**
 * Extract the file extension.
 *
 * @param {string} filename
 * @returns {string}
 */
export const getFileExtension = (filename) => {
  return path.extname(filename || "").toLowerCase();
};