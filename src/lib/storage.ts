import fs from "fs";
import path from "path";
import crypto from "crypto";
import { inspectPdfBuffer } from "./pdf";

export type FileCategory = "pvc_document" | "general_document" | "photo" | "product_image" | "payment_proof" | "profile_picture";

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
}

const UPLOAD_ROOT = path.resolve(
  process.cwd(),
  process.env.LOCAL_UPLOAD_DIR || "./uploads"
);

// Ensure base upload directories exist
function ensureUploadDirs() {
  const dirs = [
    UPLOAD_ROOT,
    path.join(UPLOAD_ROOT, "private", "pvc"),
    path.join(UPLOAD_ROOT, "private", "documents"),
    path.join(UPLOAD_ROOT, "private", "photos"),
    path.join(UPLOAD_ROOT, "private", "payments"),
    path.join(UPLOAD_ROOT, "public", "products"),
    path.join(UPLOAD_ROOT, "public", "profiles"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Validates file magic bytes against genuine file signatures.
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
    pageCount = 1; // Images count as 1 page
  }

  return {
    isValid: true,
    mimeType: detectedMime,
    pageCount,
  };
}

/**
 * Saves an uploaded file buffer to private disk storage with a cryptographic safe identifier.
 */
export async function saveFileToStorage(
  buffer: Buffer,
  originalFilename: string,
  category: FileCategory,
  validatedMime: string,
  pageCount?: number
): Promise<StoredFileInfo> {
  ensureUploadDirs();

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

  const storageKey = path.join(subFolder, storedFilename).replace(/\\/g, "/");
  const fullDiskPath = path.join(UPLOAD_ROOT, storageKey);

  await fs.promises.writeFile(fullDiskPath, buffer);

  return {
    fileId,
    originalFilename: sanitizeFilename(originalFilename),
    storedFilename,
    storageKey,
    fileSize: buffer.length,
    mimeType: validatedMime,
    fileCategory: category,
    pageCount,
  };
}

export function getFullPathFromStorageKey(storageKey: string): string {
  // Prevent path traversal
  const normalized = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, "");
  return path.join(UPLOAD_ROOT, normalized);
}

export async function deleteFileFromStorage(storageKey: string): Promise<boolean> {
  try {
    const fullPath = getFullPathFromStorageKey(storageKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to delete file:", storageKey, err);
    return false;
  }
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 100);
}
