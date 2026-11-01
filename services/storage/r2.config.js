import dotenv from "dotenv";

dotenv.config();

const requiredEnv = [
  "R2_ENDPOINT",
  "R2_PUBLIC_BUCKET_NAME",
  "R2_PUBLIC_ACCESS_KEY_ID",
  "R2_PUBLIC_SECRET_ACCESS_KEY",
  "R2_PRIVATE_BUCKET_NAME",
  "R2_PRIVATE_ACCESS_KEY_ID",
  "R2_PRIVATE_SECRET_ACCESS_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const r2Config = {
  endpoint: process.env.R2_ENDPOINT,
  region: process.env.R2_REGION || "auto",

  public: {
    bucket: process.env.R2_PUBLIC_BUCKET_NAME,
    accessKeyId: process.env.R2_PUBLIC_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_PUBLIC_SECRET_ACCESS_KEY,
    publicUrl: process.env.R2_PUBLIC_URL,
  },

  private: {
    bucket: process.env.R2_PRIVATE_BUCKET_NAME,
    accessKeyId: process.env.R2_PRIVATE_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_PRIVATE_SECRET_ACCESS_KEY,
  },
};