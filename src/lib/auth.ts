import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import * as React from "react";
import { db } from "@/db";
import { users, sessions, verificationTokens, accountAppeals } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "bishnu_session";
const SESSION_MAX_AGE_DAYS = parseInt(
  process.env.SESSION_MAX_AGE_DAYS || "14",
  10
);

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOtp(length: number = 6): string {
  // Cryptographically secure numeric OTP
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return crypto.randomInt(min, max + 1).toString();
}

export async function createSession(userId: string) {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  await db.insert(sessions).values({
    id: `sess_${crypto.randomUUID()}`,
    userId,
    sessionToken,
    expiresAt,
  });

  return { sessionToken, expiresAt };
}

export async function invalidateSession(sessionToken: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
}

export async function invalidateAllUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function blockCustomer({
  userId,
  adminId,
  reason,
  category,
}: {
  userId: string;
  adminId: string;
  reason: string;
  category: "spam" | "abusive" | "fraud" | "misuse" | "other" | string;
}) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRows.length === 0) {
    throw new Error("Customer not found");
  }
  const user = userRows[0];
  if (user.role === "admin") {
    throw new Error("Admin accounts cannot be blocked");
  }

  const now = Date.now();
  await db
    .update(users)
    .set({
      status: "blocked",
      blockedAt: now,
      blockedReason: reason.trim(),
      blockedCategory: category,
      blockedByAdminId: adminId,
    })
    .where(eq(users.id, userId));

  // Invalidate all sessions immediately across all devices
  await db.delete(sessions).where(eq(sessions.userId, userId));

  return { success: true, userId, blockedAt: now };
}

export async function unblockCustomer({
  userId,
  adminId,
}: {
  userId: string;
  adminId?: string;
}) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRows.length === 0) {
    throw new Error("Customer not found");
  }

  await db
    .update(users)
    .set({
      status: "active",
      blockedAt: null,
      blockedReason: null,
      blockedCategory: null,
      blockedByAdminId: null,
    })
    .where(eq(users.id, userId));

  // Update any open appeals to approved
  const now = Date.now();
  await db
    .update(accountAppeals)
    .set({
      status: "approved",
      adminDecision: "Customer unblocked by administrator",
      reviewedByAdminId: adminId || null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(and(eq(accountAppeals.userId, userId), eq(accountAppeals.status, "submitted")));

  return { success: true, userId };
}

export async function validateSession(sessionToken: string) {
  const now = Date.now();
  const sessionRows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionToken, sessionToken),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (sessionRows.length === 0) {
    return null;
  }

  const { session, user } = sessionRows[0];

  if (user.status === "blocked") {
    // Immediately invalidate all active sessions for blocked user
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    return null;
  }

  const { passwordHash: _, ...safeUser } = user;

  return { session, user: safeUser };
}

const memoizeRequest =
  typeof (React as any).cache === "function"
    ? (React as any).cache
    : <T extends Function>(fn: T): T => fn;

export const getAuthSession = memoizeRequest(async () => {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }
    return await validateSession(token);
  } catch {
    return null;
  }
});

export function setSessionCookie(token: string, expiresAt: number) {
  const cookieStore = cookies();
  const isProduction = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

// Rate-limiting & Token generation for OTP / Password Reset
export async function createVerificationToken(
  identifier: string,
  type: "email_verify" | "phone_otp" | "password_reset",
  ttlMinutes: number = 10
) {
  // Check cooldown: do not allow resending if an active token was generated in last 60 seconds
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const recentTokens = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.type, type),
        gt(verificationTokens.createdAt, oneMinuteAgo)
      )
    );

  if (recentTokens.length > 0) {
    throw new Error("Please wait at least 60 seconds before requesting another code.");
  }

  // Delete expired or previous tokens of this type for this identifier
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.type, type)
      )
    );

  const rawCode = generateOtp(6);
  const tokenHash = hashToken(rawCode);
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

  await db.insert(verificationTokens).values({
    id: `tok_${crypto.randomUUID()}`,
    identifier,
    tokenHash,
    type,
    expiresAt,
    attempts: 0,
  });

  return { code: rawCode, expiresAt };
}

export async function verifyOtp(
  identifier: string,
  type: "email_verify" | "phone_otp" | "password_reset",
  code: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();
  const tokens = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.type, type),
        gt(verificationTokens.expiresAt, now)
      )
    )
    .limit(1);

  if (tokens.length === 0) {
    return {
      success: false,
      error: "Verification code has expired or does not exist. Please request a new one.",
    };
  }

  const record = tokens[0];

  if (record.attempts >= 5) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, record.id));
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
    };
  }

  const inputHash = hashToken(code.trim());
  if (record.tokenHash !== inputHash) {
    // Increment attempts
    await db
      .update(verificationTokens)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verificationTokens.id, record.id));

    return {
      success: false,
      error: `Invalid verification code. ${4 - record.attempts} attempt(s) remaining.`,
    };
  }

  // Successfully verified! Consume token immediately to prevent replay
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.id, record.id));

  return { success: true };
}

export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<{ valid: boolean; error?: string; user?: any }> {
  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;

  if (!configuredEmail || (!configuredPassword && !configuredHash)) {
    console.error(
      "ADMIN_EMAIL or ADMIN_PASSWORD/ADMIN_PASSWORD_HASH is not set in environment variables."
    );
    return {
      valid: false,
      error:
        "Admin authentication is temporarily unavailable. Server environment configuration missing.",
    };
  }

  // 1. Verify Email
  const cleanInputEmail = email.trim().toLowerCase();
  const cleanConfigEmail = configuredEmail.trim().toLowerCase();
  if (cleanInputEmail !== cleanConfigEmail) {
    return { valid: false, error: "Invalid administrator credentials." };
  }

  // 2. Fetch existing admin record from DB to check for updated database credentials
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, cleanConfigEmail))
    .limit(1);

  let isPasswordValid = false;

  // A. Database credential precedence: If admin changed password in the UI, verify against database hash
  if (existingUsers.length > 0 && existingUsers[0].passwordUpdatedAt) {
    isPasswordValid = await bcrypt.compare(password, existingUsers[0].passwordHash);
  }

  // B. Environment variable bootstrap & recovery fallback:
  if (!isPasswordValid) {
    if (configuredHash) {
      isPasswordValid = await bcrypt.compare(password, configuredHash);
    } else if (configuredPassword) {
      const inputBuf = Buffer.from(password);
      const configBuf = Buffer.from(configuredPassword);
      if (inputBuf.length === configBuf.length) {
        isPasswordValid = crypto.timingSafeEqual(inputBuf, configBuf);
      }
    }
  }

  if (!isPasswordValid) {
    return { valid: false, error: "Invalid administrator credentials." };
  }

  // 3. Ensure admin user exists in DB and has admin role
  let adminUser: any;
  if (existingUsers.length > 0) {
    adminUser = existingUsers[0];
    if (adminUser.role !== "admin") {
      await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, adminUser.id));
      adminUser.role = "admin";
    }
  } else {
    // Create admin user record on initial bootstrap
    const adminId = `usr_admin_${crypto.randomUUID().slice(0, 8)}`;
    const passHash = await hashPassword(password);
    await db.insert(users).values({
      id: adminId,
      fullName: process.env.ADMIN_NAME || "Bishnu Studio Admin",
      email: cleanConfigEmail,
      phone: process.env.ADMIN_PHONE || "9876543210",
      passwordHash: passHash,
      role: "admin",
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    adminUser = {
      id: adminId,
      fullName: process.env.ADMIN_NAME || "Bishnu Studio Admin",
      email: cleanConfigEmail,
      phone: process.env.ADMIN_PHONE || "9876543210",
      role: "admin",
      isEmailVerified: true,
      isPhoneVerified: true,
    };
  }

  const { passwordHash: _, ...safeUser } = adminUser;
  return { valid: true, user: safeUser };
}

export async function requireAdminSession() {
  const auth = await getAuthSession();
  if (!auth?.user || auth.user.role !== "admin") {
    return null;
  }
  return auth;
}
