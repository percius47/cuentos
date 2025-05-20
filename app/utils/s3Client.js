import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Function to upload a file to S3
export async function uploadToS3(file, key, contentType) {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

// Function to get a file from S3
export async function getFromS3(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    return response.Body;
  } catch (error) {
    console.error("Error getting from S3:", error);
    throw error;
  }
}

// Function to generate a unique key for S3
export function generateS3Key(prefix, filename) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${prefix}/${timestamp}-${randomString}-${filename}`;
}
