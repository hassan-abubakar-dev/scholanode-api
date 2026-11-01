import { S3Client } from "@aws-sdk/client-s3";
import { r2Config } from "./r2.config.js";

// Client for public assets
export const publicR2Client = new S3Client({
  region: r2Config.region,
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.public.accessKeyId,
    secretAccessKey: r2Config.public.secretAccessKey,
  },
});

// Client for private media
export const privateR2Client = new S3Client({
  region: r2Config.region,
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.private.accessKeyId,
    secretAccessKey: r2Config.private.secretAccessKey,
  },
});