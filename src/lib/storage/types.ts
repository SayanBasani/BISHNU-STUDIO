export type FileCategory =
  | "pvc_document"
  | "general_document"
  | "photo"
  | "product_image"
  | "payment_proof"
  | "profile_picture";

export interface FileValidationResult {
  isValid: boolean;
  mimeType?: string;
  pageCount?: number;
  error?: string;
}

export interface StoredFileInfo {
  fileId: string;
  originalFilename: string;
  storedFilename: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  fileCategory: FileCategory;
  pageCount?: number;
  storageProvider: "local" | "r2";
  publicUrl?: string;
}

export type StorageProviderType = "local" | "r2";

export interface StorageAdapter {
  readonly providerType: StorageProviderType;
  uploadFile(
    buffer: Buffer,
    storageKey: string,
    mimeType: string,
    isPublic?: boolean
  ): Promise<{ storageKey: string; publicUrl?: string }>;
  downloadFile(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<boolean>;
  fileExists(storageKey: string): Promise<boolean>;
  getSignedDownloadUrl(storageKey: string, expiresInSec?: number): Promise<string>;
  getPublicUrl(storageKey: string): string | null;
}
