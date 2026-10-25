import { describe, it, expect, beforeAll } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createVerificationToken,
  verifyOtp,
  hashToken,
} from "../src/lib/auth";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Authentication & Password Security Engine", () => {
  it("should securely hash and verify passwords using bcryptjs with salt", async () => {
    const password = "SecurePassword@2026!";
    const hash = await hashPassword(password);

    expect(hash).not.toEqual(password);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword("WrongPassword123!", hash);
    expect(isWrongMatch).toBe(false);
  });

  it("should generate cryptographically secure OTP tokens and verify correctly", async () => {
    const testId = "test_user_otp@example.com";
    const { code, expiresAt } = await createVerificationToken(testId, "email_verify", 10);

    expect(code).toBeDefined();
    expect(code.length).toBe(6);
    expect(expiresAt).toBeGreaterThan(Date.now());

    // Successful verification
    const result = await verifyOtp(testId, "email_verify", code);
    expect(result.success).toBe(true);

    // Replay prevention: token must be consumed and unusable a second time
    const replayResult = await verifyOtp(testId, "email_verify", code);
    expect(replayResult.success).toBe(false);
  });

  it("should enforce maximum OTP attempt limits", async () => {
    const testId = "test_user_limits@example.com";
    await createVerificationToken(testId, "phone_otp", 10);

    // Enter wrong code repeatedly
    for (let i = 0; i < 5; i++) {
      const res = await verifyOtp(testId, "phone_otp", "000000");
      expect(res.success).toBe(false);
    }

    // 6th attempt should be blocked due to maximum attempts exceeded
    const blockedRes = await verifyOtp(testId, "phone_otp", "000000");
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toContain("Maximum verification attempts exceeded");
  });
});
