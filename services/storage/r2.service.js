import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { r2Config } from "./r2.config.js";

import {
  publicR2Client,
  privateR2Client,
} from "./r2.clients.js";

import { generateR2Key } from "./r2.helpers.js";

const SIGNED_UPLOAD_EXPIRY = 300; // 5 minutes
const SIGNED_DOWNLOAD_EXPIRY = 300; // 5 minutes

/**
 * Generate a signed upload URL.
 */
const generateUploadUrl = async ({
  client,
  bucket,
  folder,
  originalName,
  contentType,
}) => {
  const key = generateR2Key(folder, originalName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: SIGNED_UPLOAD_EXPIRY,
  });

  return { uploadUrl, key };
};

/**
 * Generate a signed download URL.
 */
const generateDownloadUrl = async ({ client, bucket, key }) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, {
    expiresIn: SIGNED_DOWNLOAD_EXPIRY,
  });
};

/**
 * Delete an object from R2.
 */
const deleteObject = async ({ client, bucket, key }) => {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
};

/**
 * Check whether an object exists.
 */
const objectExists = async ({ client, bucket, key }) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    if (
      error.name === "NotFound" ||
      error.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }

    throw error;
  }
};

/* =========================================
   PUBLIC BUCKET OPERATIONS
========================================= */

export const uploadPublicFile = async ({
  folder,
  originalName,
  contentType,
}) => {
  const result = await generateUploadUrl({
    client: publicR2Client,
    bucket: r2Config.public.bucket,
    folder,
    originalName,
    contentType,
  });

  return {
    ...result,
    publicUrl: `${r2Config.public.publicUrl.replace(/\/+$/, "")}/${result.key}`,
  };
};

export const getPublicFileUrl = (key) =>
  key && r2Config.public.publicUrl
    ? `${r2Config.public.publicUrl.replace(/\/+$/, "")}/${key}`
    : null;

export const deletePublicFile = async (key) => {
  return deleteObject({
    client: publicR2Client,
    bucket: r2Config.public.bucket,
    key,
  });
};

export const publicFileExists = async (key) => {
  return objectExists({
    client: publicR2Client,
    bucket: r2Config.public.bucket,
    key,
  });
};

export const getPublicFileMetadata = async (key) => {
  const command = new HeadObjectCommand({
    Bucket: r2Config.public.bucket,
    Key: key,
  });

  const result = await publicR2Client.send(command);

  return {
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
};

/* =========================================
   PRIVATE BUCKET OPERATIONS
========================================= */

export const uploadPrivateFile = async ({
  folder,
  originalName,
  contentType,
}) => {
  return generateUploadUrl({
    client: privateR2Client,
    bucket: r2Config.private.bucket,
    folder,
    originalName,
    contentType,
  });
};

export const getPrivateFileUrl = async (key) => {
  return generateDownloadUrl({
    client: privateR2Client,
    bucket: r2Config.private.bucket,
    key,
  });
};

export const deletePrivateFile = async (key) => {
  return deleteObject({
    client: privateR2Client,
    bucket: r2Config.private.bucket,
    key,
  });
};

export const privateFileExists = async (key) => {
  return objectExists({
    client: privateR2Client,
    bucket: r2Config.private.bucket,
    key,
  });
};

export const getPrivateFileMetadata = async (key) => {
  const command = new HeadObjectCommand({
    Bucket: r2Config.private.bucket,
    Key: key,
  });

  const result = await privateR2Client.send(command);

  return {
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
};