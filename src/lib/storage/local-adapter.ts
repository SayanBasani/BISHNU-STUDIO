import fs from "fs";
import path from "path";
import { StorageAdapter, StorageProviderType } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  readonly providerType: StorageProviderType = "local";
  private uploadRoot: string;

  constructor(customUploadDir?: string) {
    this.uploadRoot = path.resolve(
      process.cwd(),
      customUploadDir || process.env.LOCAL_UPLOAD_DIR || "./uploads"
    );
    this.ensureUploadDirs();
  }

  private ensureUploadDirs() {
    const dirs = [
      this.uploadRoot,
      path.join(this.uploadRoot, "private", "pvc"),
      path.join(this.uploadRoot, "private", "documents"),
      path.join(this.uploadRoot, "private", "photos"),
      path.join(this.uploadRoot, "private", "payments"),
      path.join(this.uploadRoot, "public", "products"),
      path.join(this.uploadRoot, "public", "profiles"),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public getFullDiskPath(storageKey: string): string {
    const safeKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, "");
    return path.join(this.uploadRoot, safeKey);
  }

  async uploadFile(
    buffer: Buffer,
    storageKey: string,
    _mimeType: string,
    _isPublic?: boolean
  ): Promise<{ storageKey: string; publicUrl?: string }> {
    const fullDiskPath = this.getFullDiskPath(storageKey);
    const parentDir = path.dirname(fullDiskPath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(fullDiskPath, buffer);
    return { storageKey };
  }

  async downloadFile(storageKey: string): Promise<Buffer> {
    const fullDiskPath = this.getFullDiskPath(storageKey);
    if (!fs.existsSync(fullDiskPath)) {
      throw new Error(`File not found on local storage: ${storageKey}`);
    }
    return await fs.promises.readFile(fullDiskPath);
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const fullDiskPath = this.getFullDiskPath(storageKey);
      if (fs.existsSync(fullDiskPath)) {
        await fs.promises.unlink(fullDiskPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to delete local file ${storageKey}:`, err);
      return false;
    }
  }

  async fileExists(storageKey: string): Promise<boolean> {
    const fullDiskPath = this.getFullDiskPath(storageKey);
    return fs.existsSync(fullDiskPath);
  }

  async getSignedDownloadUrl(storageKey: string, _expiresInSec?: number): Promise<string> {
    // For local storage, proxy through the application's authenticated download route
    return `/api/files/download/${encodeURIComponent(storageKey)}`;
  }

  getPublicUrl(storageKey: string): string | null {
    if (storageKey.startsWith("public/")) {
      return `/uploads/${storageKey}`;
    }
    return null;
  }
}
