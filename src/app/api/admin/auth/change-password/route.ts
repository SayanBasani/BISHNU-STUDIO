import { NextRequest, NextResponse } from "next/server";
import {
  getAuthSession,
  hashPassword,
  verifyPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { cookies } from "next/headers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current administrator password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*[0-9!@#$%^&*])/,
        "New password must contain both letters and at least one number or special character"
      ),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password cannot be identical to current administrator password",
    path: ["newPassword"],
  });

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator authorization required." },
        { status: 403 }
      );
    }

    // Rate limit password change attempts: max 5 per 15 minutes
    const rateCheck = checkRateLimit(auth.user.id, "admin_change_password", {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many password change attempts. Please wait ${rateCheck.retryAfterSec} seconds before trying again.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = adminChangePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Fetch admin user record
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.id, auth.user.id))
      .limit(1);

    if (adminUser.length === 0) {
      return NextResponse.json(
        { error: "Administrator account record not found." },
        { status: 404 }
      );
    }

    // Verify current password against database hash or environment fallback
    let isCurrentValid = false;

    // 1. Check database hash if password was previously changed
    if (adminUser[0].passwordUpdatedAt) {
      isCurrentValid = await verifyPassword(
        currentPassword,
        adminUser[0].passwordHash
      );
    }

    // 2. Check environment fallback if not verified yet
    if (!isCurrentValid) {
      const configuredHash = process.env.ADMIN_PASSWORD_HASH;
      const configuredPassword = process.env.ADMIN_PASSWORD;

      if (configuredHash) {
        isCurrentValid = await verifyPassword(currentPassword, configuredHash);
      } else if (configuredPassword) {
        const inputBuf = Buffer.from(currentPassword);
        const configBuf = Buffer.from(configuredPassword);
        if (inputBuf.length === configBuf.length) {
          isCurrentValid = crypto.timingSafeEqual(inputBuf, configBuf);
        }
      }
    }

    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Incorrect current administrator password." },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt
    const newHash = await hashPassword(newPassword);
    const now = Date.now();

    // Persist to database so it survives server restarts, container lifecycles, and deployments
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        passwordUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, auth.user.id));

    // Invalidate other active admin sessions
    const currentCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (currentCookie) {
      await db
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, auth.user.id),
            ne(sessions.sessionToken, currentCookie)
          )
        );
    }

    // Record security audit event
    await logAuditEvent({
      userId: auth.user.id,
      action: "admin_password_changed",
      entityType: "auth",
      entityId: auth.user.id,
      details: {
        timestamp: now,
        databasePrecedenceActive: true,
        otherSessionsInvalidated: true,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Administrator password changed successfully. The new password is saved in persistent storage and takes precedence over initial environment defaults.",
    });
  } catch (error: any) {
    console.error("Admin change password error:", error);
    return NextResponse.json(
      { error: "Failed to change administrator password. Please try again." },
      { status: 500 }
    );
  }
}
