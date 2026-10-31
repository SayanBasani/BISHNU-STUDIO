import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageAdapter, StorageProviderType } from "./types";

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
  publicBaseUrl?: string;
}

export class R2StorageAdapter implements StorageAdapter {
  readonly providerType: StorageProviderType = "r2";
  private client: S3Client;
  private bucketName: string;
  private publicBaseUrl?: string;

  constructor(config?: R2Config) {
    const accountId = config?.accountId || process.env.R2_ACCOUNT_ID || "";
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID || "";
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || "";
    this.bucketName = config?.bucketName || process.env.R2_BUCKET_NAME || "";
    this.publicBaseUrl = (config?.publicBaseUrl || process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

    let endpoint = config?.endpoint || process.env.R2_ENDPOINT;
    if (!endpoint && accountId) {
      endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    }

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error(
        "R2StorageAdapter configuration error: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required."
      );
    }

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(
    buffer: Buffer,
    storageKey: string,
    mimeType: string,
    isPublic?: boolean
  ): Promise<{ storageKey: string; publicUrl?: string }> {
    const cleanKey = storageKey.replace(/^\/+/, "");
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.client.send(command);

      let publicUrl: string | undefined = undefined;
      if (isPublic && this.publicBaseUrl && cleanKey.startsWith("public/")) {
        publicUrl = `${this.publicBaseUrl}/${cleanKey}`;
      }

      return { storageKey: cleanKey, publicUrl };
    } catch (err: any) {
      console.error(`R2 upload failed for key ${cleanKey}:`, err.message || err);
      throw new Error(`Failed to upload object to cloud storage.`);
    }
  }

  async downloadFile(storageKey: string): Promise<Buffer> {
    const cleanKey = storageKey.replace(/^\/+/, "");
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error(`Empty response body from R2 for ${cleanKey}`);
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        throw new Error(`Object not found in cloud storage: ${cleanKey}`);
      }
      console.error(`R2 download error for key ${cleanKey}:`, err.message || err);
      throw new Error(`Failed to retrieve object from cloud storage.`);
    }
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const cleanKey = storageKey.replace(/^\/+/, "");
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      console.error(`R2 delete failed for key ${cleanKey}:`, err.message || err);
      return false;
    }
  }

  async fileExists(storageKey: string): Promise<boolean> {
    const cleanKey = storageKey.replace(/^\/+/, "");
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      return false;
    }
  }

  async getSignedDownloadUrl(storageKey: string, expiresInSec: number = 900): Promise<string> {
    const cleanKey = storageKey.replace(/^\/+/, "");
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSec });
    } catch (err: any) {
      console.error(`Failed to generate signed URL for key ${cleanKey}:`, err.message || err);
      throw new Error("Failed to generate secure signed download URL.");
    }
  }

  getPublicUrl(storageKey: string): string | null {
    const cleanKey = storageKey.replace(/^\/+/, "");
    if (this.publicBaseUrl && cleanKey.startsWith("public/")) {
      return `${this.publicBaseUrl}/${cleanKey}`;
    }
    return null;
  }
}
