import crypto from "crypto";
import path from "path";
import { inspectPdfBuffer } from "../pdf";
import {
  FileCategory,
  FileValidationResult,
  StoredFileInfo,
  StorageAdapter,
  StorageProviderType,
} from "./types";
import { LocalStorageAdapter } from "./local-adapter";
import { R2StorageAdapter } from "./r2-adapter";

export * from "./types";
export { LocalStorageAdapter } from "./local-adapter";
export { R2StorageAdapter } from "./r2-adapter";

let cachedAdapter: StorageAdapter | null = null;
let cachedProviderType: StorageProviderType | null = null;

/**
 * Returns the configured storage adapter (R2 if STORAGE_PROVIDER === 'r2', else Local filesystem).
 */
export function getStorageAdapter(forceNew: boolean = false): StorageAdapter {
  const desiredProvider = (process.env.STORAGE_PROVIDER?.toLowerCase() || "local") as StorageProviderType;

  if (cachedAdapter && !forceNew && cachedProviderType === desiredProvider) {
    return cachedAdapter;
  }

  if (desiredProvider === "r2") {
    try {
      const r2 = new R2StorageAdapter();
      cachedAdapter = r2;
      cachedProviderType = "r2";
      return r2;
    } catch (err: any) {
      console.warn(
        `[STORAGE WARNING] STORAGE_PROVIDER is set to 'r2', but initialization failed (${err.message}). Falling back to local disk storage.`
      );
      const local = new LocalStorageAdapter();
      cachedAdapter = local;
      cachedProviderType = "local";
      return local;
    }
  }

  const local = new LocalStorageAdapter();
  cachedAdapter = local;
  cachedProviderType = "local";
  return local;
}

/**
 * Validates file magic bytes against genuine file signatures and size limits.
 */
export async function validateFileBuffer(
  buffer: Buffer,
  declaredMime: string,
  category: FileCategory
): Promise<FileValidationResult> {
  const maxDocMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "25", 10);
  const maxPhotoMb = parseInt(process.env.MAX_PHOTO_SIZE_MB || "10", 10);
  const maxProfileMb = parseInt(process.env.MAX_PROFILE_SIZE_MB || "5", 10);

  const maxBytes =
    (category === "profile_picture"
      ? maxProfileMb
      : category === "photo"
      ? maxPhotoMb
      : maxDocMb) *
    1024 *
    1024;

  if (buffer.length > maxBytes) {
    return {
      isValid: false,
      error: `File size exceeds the allowed maximum of ${
        category === "profile_picture"
          ? maxProfileMb
          : category === "photo"
          ? maxPhotoMb
          : maxDocMb
      } MB.`,
    };
  }

  if (buffer.length < 12) {
    return {
      isValid: false,
      error: "File is too small or truncated to be a valid document.",
    };
  }

  // Check Magic Bytes
  const isPdf = buffer.toString("utf-8", 0, 5) === "%PDF-";
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer.toString("utf-8", 0, 4) === "RIFF" &&
    buffer.toString("utf-8", 8, 12) === "WEBP";

  let detectedMime = "";
  if (isPdf) detectedMime = "application/pdf";
  else if (isJpeg) detectedMime = "image/jpeg";
  else if (isPng) detectedMime = "image/png";
  else if (isWebp) detectedMime = "image/webp";

  if (!detectedMime) {
    return {
      isValid: false,
      error: "Unsupported file type. Only authentic PDF, JPEG, PNG, and WebP files are accepted.",
    };
  }

  // Category specific restrictions
  if (category === "photo" && detectedMime === "application/pdf") {
    return {
      isValid: false,
      error: "Photo printing requires image files (JPEG, PNG, or WebP). PDFs are not allowed for photo printing.",
    };
  }

  if (category === "product_image" && detectedMime === "application/pdf") {
    return {
      isValid: false,
      error: "Product images must be JPEG, PNG, or WebP.",
    };
  }

  if (category === "payment_proof" && detectedMime === "application/pdf") {
    return {
      isValid: false,
      error: "Payment proof must be an image screenshot (JPEG, PNG, or WebP).",
    };
  }

  if (category === "profile_picture" && detectedMime === "application/pdf") {
    return {
      isValid: false,
      error: "Profile picture must be an image (JPEG, PNG, or WebP). PDFs are not allowed.",
    };
  }

  let pageCount: number | undefined = undefined;
  if (detectedMime === "application/pdf") {
    const pdfCheck = await inspectPdfBuffer(buffer);
    if (!pdfCheck.isValid) {
      return {
        isValid: false,
        error: pdfCheck.error,
      };
    }
    pageCount = pdfCheck.pageCount;
  } else {
    pageCount = 1;
  }

  return {
    isValid: true,
    mimeType: detectedMime,
    pageCount,
  };
}

/**
 * Saves an uploaded file buffer to the active storage adapter (Local or Cloudflare R2).
 */
export async function saveFileToStorage(
  buffer: Buffer,
  originalFilename: string,
  category: FileCategory,
  validatedMime: string,
  pageCount?: number
): Promise<StoredFileInfo> {
  const fileId = `fil_${crypto.randomUUID()}`;
  const randomSuffix = crypto.randomBytes(16).toString("hex");

  // Determine safe extension based on verified MIME
  let extension = ".bin";
  if (validatedMime === "application/pdf") extension = ".pdf";
  else if (validatedMime === "image/jpeg") extension = ".jpg";
  else if (validatedMime === "image/png") extension = ".png";
  else if (validatedMime === "image/webp") extension = ".webp";

  const storedFilename = `${fileId}_${randomSuffix}${extension}`;

  let subFolder = "private/documents";
  if (category === "pvc_document") subFolder = "private/pvc";
  else if (category === "photo") subFolder = "private/photos";
  else if (category === "payment_proof") subFolder = "private/payments";
  else if (category === "product_image") subFolder = "public/products";
  else if (category === "profile_picture") subFolder = "public/profiles";

  const storageKey = path.posix.join(subFolder, storedFilename);
  const isPublic = category === "product_image" || category === "profile_picture";

  const adapter = getStorageAdapter();
  const uploadResult = await adapter.uploadFile(buffer, storageKey, validatedMime, isPublic);

  return {
    fileId,
    originalFilename: sanitizeFilename(originalFilename),
    storedFilename,
    storageKey: uploadResult.storageKey,
    fileSize: buffer.length,
    mimeType: validatedMime,
    fileCategory: category,
    pageCount,
    storageProvider: adapter.providerType,
    publicUrl: uploadResult.publicUrl,
  };
}

/**
 * Downloads a file buffer from storage using the configured adapter.
 * Includes graceful local fallback if cloud storage is active but file was not yet migrated.
 */
export async function downloadFileFromStorage(storageKey: string): Promise<Buffer> {
  const adapter = getStorageAdapter();
  if (adapter.providerType === "r2") {
    try {
      return await adapter.downloadFile(storageKey);
    } catch (r2Err) {
      // Graceful fallback to local disk if file was stored locally prior to R2 migration
      const local = new LocalStorageAdapter();
      if (await local.fileExists(storageKey)) {
        return await local.downloadFile(storageKey);
      }
      throw r2Err;
    }
  }

  try {
    return await adapter.downloadFile(storageKey);
  } catch (localErr) {
    // If local file not found, try R2 if R2 credentials exist in environment
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME) {
      try {
        const r2 = new R2StorageAdapter();
        if (await r2.fileExists(storageKey)) {
          return await r2.downloadFile(storageKey);
        }
      } catch {}
    }
    throw localErr;
  }
}

/**
 * Deletes a file from storage using the configured adapter.
 */
export async function deleteFileFromStorage(storageKey: string): Promise<boolean> {
  const adapter = getStorageAdapter();
  return await adapter.deleteFile(storageKey);
}

/**
 * Generates a presigned download URL for private files (if cloud storage) or local route.
 */
export async function getSignedDownloadUrl(storageKey: string, expiresInSec: number = 900): Promise<string> {
  const adapter = getStorageAdapter();
  return await adapter.getSignedDownloadUrl(storageKey, expiresInSec);
}

/**
 * Compatibility helper for existing local-disk path lookups.
 */
export function getFullPathFromStorageKey(storageKey: string): string {
  const uploadRoot = path.resolve(
    process.cwd(),
    process.env.LOCAL_UPLOAD_DIR || "./uploads"
  );
  const normalized = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, "");
  return path.join(uploadRoot, normalized);
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 100);
}
