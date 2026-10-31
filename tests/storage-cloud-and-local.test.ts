import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LocalStorageAdapter,
  R2StorageAdapter,
  saveFileToStorage,
  downloadFileFromStorage,
  deleteFileFromStorage,
  validateFileBuffer,
  getFullPathFromStorageKey,
  getStorageAdapter,
} from "@/lib/storage";
import fs from "fs";
import path from "path";

describe("BS-FINAL-06: Storage Architecture (Local & Cloudflare R2 Abstraction)", () => {
  const testFilesCreated: string[] = [];

  afterEach(async () => {
    for (const key of testFilesCreated) {
      await deleteFileFromStorage(key).catch(() => {});
    }
    testFilesCreated.length = 0;
  });

  describe("1. Local Storage Adapter", () => {
    it("should upload, retrieve, check existence, and delete local file", async () => {
      const adapter = new LocalStorageAdapter();
      const content = Buffer.from("Hello Bishnu Studio Storage!");
      const key = `private/documents/test_${Date.now()}.txt`;

      // Upload
      const uploadResult = await adapter.uploadFile(content, key, "text/plain");
      expect(uploadResult.storageKey).toBe(key);
      testFilesCreated.push(key);

      // Exists
      const exists = await adapter.fileExists(key);
      expect(exists).toBe(true);

      // Download
      const downloaded = await adapter.downloadFile(key);
      expect(downloaded.toString("utf8")).toBe("Hello Bishnu Studio Storage!");

      // Delete
      const deleted = await adapter.deleteFile(key);
      expect(deleted).toBe(true);
      expect(await adapter.fileExists(key)).toBe(false);
    });

    it("should prevent path traversal when computing disk path", () => {
      const adapter = new LocalStorageAdapter();
      const traversalKey = "../../etc/passwd";
      const fullPath = adapter.getFullDiskPath(traversalKey);

      expect(fullPath).not.toContain("..\\..\\etc");
      expect(fullPath).not.toContain("../../etc");
      expect(fullPath.startsWith(path.resolve(process.cwd(), "uploads"))).toBe(true);
    });

    it("should never provide a public URL for private documents", () => {
      const adapter = new LocalStorageAdapter();
      expect(adapter.getPublicUrl("private/pvc/card.pdf")).toBeNull();
      expect(adapter.getPublicUrl("private/documents/invoice.pdf")).toBeNull();
      expect(adapter.getPublicUrl("private/payments/screenshot.png")).toBeNull();
    });

    it("should provide public path for public catalog assets", () => {
      const adapter = new LocalStorageAdapter();
      expect(adapter.getPublicUrl("public/products/img_01.jpg")).toBe("/uploads/public/products/img_01.jpg");
    });
  });

  describe("2. Cloudflare R2 / S3 Adapter Interface & Fallback", () => {
    it("should require mandatory credentials when initializing R2StorageAdapter", () => {
      expect(() => {
        new R2StorageAdapter({
          accessKeyId: "",
          secretAccessKey: "",
          bucketName: "",
        });
      }).toThrow(/R2StorageAdapter configuration error/);
    });

    it("should fall back gracefully to LocalStorageAdapter if R2 initialization fails", () => {
      const origProvider = process.env.STORAGE_PROVIDER;
      process.env.STORAGE_PROVIDER = "r2";

      // Without R2 env vars set, getStorageAdapter should log warning and return local adapter
      const adapter = getStorageAdapter(true);
      expect(adapter.providerType).toBe("local");

      process.env.STORAGE_PROVIDER = origProvider;
    });

    it("should never expose credentials in R2 error messages", async () => {
      try {
        const r2 = new R2StorageAdapter({
          accessKeyId: "mock_key_id_secret_12345",
          secretAccessKey: "mock_secret_key_abcdef987654321",
          bucketName: "non-existent-test-bucket",
          endpoint: "https://mock.r2.cloudflarestorage.com",
        });
        await r2.uploadFile(Buffer.from("test"), "private/test.txt", "text/plain");
      } catch (err: any) {
        expect(err.message).not.toContain("mock_secret_key_abcdef987654321");
      }
    });
  });

  describe("3. File Validation & Magic Bytes Verification", () => {
    it("should accept valid PNG image with genuine header", async () => {
      // 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A followed by IHDR
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const result = await validateFileBuffer(pngHeader, "image/png", "payment_proof");
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe("image/png");
    });

    it("should accept valid JPEG image with genuine header", async () => {
      // JPEG SOI marker: FF D8 FF followed by valid marker
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const result = await validateFileBuffer(jpegHeader, "image/jpeg", "photo");
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe("image/jpeg");
    });

    it("should reject spoofed file pretending to be image with executable content", async () => {
      // MZ header (DOS/Windows executable) declared as image/png
      const fakeImage = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00");
      const result = await validateFileBuffer(fakeImage, "image/png", "payment_proof");
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Unsupported file type/);
    });

    it("should reject PDF uploaded under photo printing category", async () => {
      const fakePdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const result = await validateFileBuffer(fakePdf, "application/pdf", "photo");
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Photo printing requires image files/);
    });

    it("should reject oversized document exceeding size limit", async () => {
      const origLimit = process.env.MAX_UPLOAD_SIZE_MB;
      process.env.MAX_UPLOAD_SIZE_MB = "1"; // 1MB limit

      const oversized = Buffer.alloc(1.5 * 1024 * 1024); // 1.5MB
      oversized.write("%PDF-1.4", 0);

      const result = await validateFileBuffer(oversized, "application/pdf", "general_document");
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/exceeds the allowed maximum/);

      process.env.MAX_UPLOAD_SIZE_MB = origLimit;
    });
  });

  describe("4. End-to-End Save, Retrieval, and Orphan Cleanup", () => {
    it("should generate cryptographic unique storage key and save file", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const stored = await saveFileToStorage(
        pngBuffer,
        "customer_pvc.png",
        "pvc_document",
        "image/png"
      );

      testFilesCreated.push(stored.storageKey);

      expect(stored.fileId).toMatch(/^fil_/);
      expect(stored.storageKey).toMatch(/^private\/pvc\/fil_[a-zA-Z0-9-]/);
      expect(stored.storedFilename).toContain(".png");

      // Verify retrieval
      const retrieved = await downloadFileFromStorage(stored.storageKey);
      expect(retrieved.length).toBe(pngBuffer.length);
      expect(retrieved[0]).toBe(0x89);
    });

    it("should safely delete file from storage", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const stored = await saveFileToStorage(
        pngBuffer,
        "cleanup_test.png",
        "payment_proof",
        "image/png"
      );

      const deleteResult = await deleteFileFromStorage(stored.storageKey);
      expect(deleteResult).toBe(true);

      await expect(downloadFileFromStorage(stored.storageKey)).rejects.toThrow();
    });

    it("should refuse to save customer documents to ephemeral storage when in production without R2", async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origVercel = process.env.VERCEL;
      const origProvider = process.env.STORAGE_PROVIDER;

      (process.env as any).NODE_ENV = "production";
      delete process.env.STORAGE_PROVIDER;

      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

      try {
        await expect(
          saveFileToStorage(pngBuffer, "prod_doc.png", "pvc_document", "image/png")
        ).rejects.toThrow(/CRITICAL_STORAGE_ERROR/);
      } finally {
        (process.env as any).NODE_ENV = origNodeEnv;
        if (origVercel !== undefined) process.env.VERCEL = origVercel;
        if (origProvider !== undefined) process.env.STORAGE_PROVIDER = origProvider;
      }
    });
  });
});
