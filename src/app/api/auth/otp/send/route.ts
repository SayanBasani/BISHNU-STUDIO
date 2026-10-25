import { NextRequest, NextResponse } from "next/server";
import { createVerificationToken, getAuthSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const sendOtpSchema = z.object({
  identifier: z.string().min(3),
  type: z.enum(["email_verify", "phone_otp", "password_reset"]),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = checkRateLimit(ip, "send_otp", { limit: 5, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.retryAfterSec}s before requesting another OTP.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = sendOtpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { identifier, type } = validation.data;
    const cleanId = identifier.trim().toLowerCase();

    // Verify user exists if this is for password reset
    if (type === "password_reset") {
      const userExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, cleanId))
        .limit(1);

      if (userExists.length === 0) {
        return NextResponse.json(
          { error: "No account found with this email address." },
          { status: 404 }
        );
      }
    }

    const { code, expiresAt } = await createVerificationToken(cleanId, type, 10);

    // If an email provider (SMTP/SendGrid) or SMS provider is configured, dispatch here.
    // In local development or testing mode, log code to server console and provide simulated response:
    console.log(`[Bishnu Studio Auth] Generated OTP for ${cleanId} (${type}): ${code}`);

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${identifier}.`,
      expiresAt,
      // Provide simulated code for easy verification during development/testing
      devCodeHint: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate verification code." },
      { status: 400 }
    );
  }
}
