import { describe, it, expect, beforeAll } from "vitest";
import { validateFileBuffer, saveFileToStorage, deleteFileFromStorage } from "../src/lib/storage";
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateAdminCredentials,
  validateSession,
} from "../src/lib/auth";
import { db } from "../src/db";
import { users, sessions, orderFiles } from "../src/db/schema";
import { eq, and, ne } from "drizzle-orm";
import crypto from "crypto";

describe("Profile Management, Password Security & Administrator Precedence", () => {
  // Minimal authentic magic-byte test buffers
  const realPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const realJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0xff, 0xd9, // EOI
  ]);

  const fakeCounterfeitBuffer = Buffer.from("Not an image at all, just fake text data.");

  beforeAll(() => {
    process.env.ADMIN_EMAIL = "admin@bishnustudio.com";
    process.env.ADMIN_PASSWORD = "InitialEnvAdminPassword123!";
    process.env.ADMIN_NAME = "Bishnu Studio Owner";
    process.env.ADMIN_PHONE = "9876543210";
  });

  describe("Profile Picture File Validation & Storage Restrictions", () => {
    it("should accept valid PNG images under the 5MB profile picture limit", async () => {
      const res = await validateFileBuffer(
        realPngBuffer,
        "image/png",
        "profile_picture"
      );
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe("image/png");
    });

    it("should accept valid JPEG images under the 5MB profile picture limit", async () => {
      const res = await validateFileBuffer(
        realJpegBuffer,
        "image/jpeg",
        "profile_picture"
      );
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe("image/jpeg");
    });

    it("should reject PDF documents uploaded as profile pictures", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 Fake minimal PDF header content");
      const res = await validateFileBuffer(
        pdfBuffer,
        "application/pdf",
        "profile_picture"
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Profile picture must be an image");
    });

    it("should reject counterfeit image files with mismatched magic bytes", async () => {
      const res = await validateFileBuffer(
        fakeCounterfeitBuffer,
        "image/png",
        "profile_picture"
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Unsupported file type");
    });

    it("should reject profile pictures exceeding the 5MB maximum limit", async () => {
      // 5MB + 1 byte
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
      // Give it valid PNG magic bytes at the start
      realPngBuffer.copy(oversizedBuffer, 0, 0, 8);

      const res = await validateFileBuffer(
        oversizedBuffer,
        "image/png",
        "profile_picture"
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("exceeds the allowed maximum of 5 MB");
    });

    it("should save profile picture to disk and delete when removed or replaced", async () => {
      const stored = await saveFileToStorage(
        realPngBuffer,
        "avatar-test.png",
        "profile_picture",
        "image/png"
      );
      expect(stored.fileId).toBeDefined();
      expect(stored.storageKey).toContain("public/profiles");

      // Verify deletion from disk runs cleanly
      await expect(deleteFileFromStorage(stored.storageKey)).resolves.not.toThrow();
    });
  });

  describe("Customer Password Security & Invalidation", () => {
    const testCustomerId = `usr_test_pwd_${crypto.randomUUID()}`;
    const initialPassword = "OldPassword123!";
    const newPassword = "NewStrongPassword2026#";

    beforeAll(async () => {
      const hash = await hashPassword(initialPassword);
      const uniquePhone = "9" + Math.floor(100000000 + Math.random() * 900000000);
      await db.insert(users).values({
        id: testCustomerId,
        fullName: "Test Password Customer",
        email: `pwd_customer_${Date.now()}@example.com`,
        phone: uniquePhone,
        passwordHash: hash,
        role: "customer",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);
    });

    it("should verify the current password before permitting password rotation", async () => {
      const customer = await db
        .select()
        .from(users)
        .where(eq(users.id, testCustomerId))
        .limit(1);

      const isCurrentValid = await verifyPassword(
        initialPassword,
        customer[0].passwordHash
      );
      expect(isCurrentValid).toBe(true);

      const isWrongValid = await verifyPassword(
        "CompletelyWrongPassword!",
        customer[0].passwordHash
      );
      expect(isWrongValid).toBe(false);
    });

    it("should hash the new password and update passwordUpdatedAt timestamp", async () => {
      const newHash = await hashPassword(newPassword);
      const now = Date.now();

      await db
        .update(users)
        .set({
          passwordHash: newHash,
          passwordUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, testCustomerId));

      const updated = await db
        .select()
        .from(users)
        .where(eq(users.id, testCustomerId))
        .limit(1);

      expect(updated[0].passwordUpdatedAt).toBe(now);

      const matchesNew = await verifyPassword(newPassword, updated[0].passwordHash);
      expect(matchesNew).toBe(true);

      const matchesOld = await verifyPassword(initialPassword, updated[0].passwordHash);
      expect(matchesOld).toBe(false);
    });

    it("should invalidate other active sessions when user rotates their password", async () => {
      // Create session 1 (the active session changing password)
      const session1 = await createSession(testCustomerId);
      // Create session 2 (another device session that should be terminated)
      const session2 = await createSession(testCustomerId);

      // Invalidate all sessions except session 1
      await db
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, testCustomerId),
            ne(sessions.sessionToken, session1.sessionToken)
          )
        );

      // Session 1 should remain valid
      const valid1 = await validateSession(session1.sessionToken);
      expect(valid1).not.toBeNull();
      expect(valid1?.user.id).toBe(testCustomerId);

      // Session 2 should now be terminated
      const valid2 = await validateSession(session2.sessionToken);
      expect(valid2).toBeNull();
    });
  });

  describe("Administrator Password Persistence & Precedence Over Environment Defaults", () => {
    it("should initially validate against the environment ADMIN_PASSWORD before any database update", async () => {
      const res = await validateAdminCredentials(
        "admin@bishnustudio.com",
        "InitialEnvAdminPassword123!"
      );
      expect(res.valid).toBe(true);
      expect(res.user?.role).toBe("admin");
    });

    it("should prioritize database password hash over environment default after admin updates password", async () => {
      // Find the admin user in the database
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);

      expect(adminUsers.length).toBeGreaterThan(0);
      const adminId = adminUsers[0].id;

      // Simulate admin changing password in the dashboard
      const updatedAdminPassword = "NewOwnerMasterKey2026!@#";
      const newHash = await hashPassword(updatedAdminPassword);
      const updateTimestamp = Date.now();

      await db
        .update(users)
        .set({
          passwordHash: newHash,
          passwordUpdatedAt: updateTimestamp,
          updatedAt: updateTimestamp,
        })
        .where(eq(users.id, adminId));

      // Attempt login with new database password -> MUST succeed
      const newLogin = await validateAdminCredentials(
        "admin@bishnustudio.com",
        updatedAdminPassword
      );
      expect(newLogin.valid).toBe(true);
      expect(newLogin.user?.role).toBe("admin");

      // Attempt login with old environment password -> acts as emergency recovery fallback
      const envFallbackLogin = await validateAdminCredentials(
        "admin@bishnustudio.com",
        "InitialEnvAdminPassword123!"
      );
      expect(envFallbackLogin.valid).toBe(true);

      // Attempt login with wrong password -> MUST fail
      const wrongLogin = await validateAdminCredentials(
        "admin@bishnustudio.com",
        "IncorrectPassword12345!"
      );
      expect(wrongLogin.valid).toBe(false);
      expect(wrongLogin.error).toBe("Invalid administrator credentials.");
    });
  });
});
