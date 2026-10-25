import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, hashPassword, verifyPassword, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
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
    message: "New password cannot be identical to your current password",
    path: ["newPassword"],
  });

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit password change attempts: max 5 per 15 minutes per user
    const rateCheck = checkRateLimit(auth.user.id, "change_password", {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many password change attempts. Please try again in ${rateCheck.retryAfterSec} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Fetch user password hash from DB
    const userRecord = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, auth.user.id))
      .limit(1);

    if (userRecord.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(
      currentPassword,
      userRecord[0].passwordHash
    );

    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Incorrect current password. Please verify and try again." },
        { status: 400 }
      );
    }

    // Hash new password securely with bcrypt
    const newHash = await hashPassword(newPassword);
    const now = Date.now();

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        passwordUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, auth.user.id));

    // Invalidate other active sessions for this user for security
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

    // Log security audit event
    await logAuditEvent({
      userId: auth.user.id,
      action: "password_changed",
      entityType: "auth",
      entityId: auth.user.id,
      details: {
        timestamp: now,
        otherSessionsInvalidated: true,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Your password has been changed successfully. All other active sessions have been signed out.",
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Failed to change password. Please try again." },
      { status: 500 }
    );
  }
}
