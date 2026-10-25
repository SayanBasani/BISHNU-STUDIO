import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const verifyOtpSchema = z.object({
  identifier: z.string().min(3),
  type: z.enum(["email_verify", "phone_otp", "password_reset"]),
  code: z.string().min(6).max(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = verifyOtpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { identifier, type, code } = validation.data;
    const cleanId = identifier.trim().toLowerCase();

    const result = await verifyOtp(cleanId, type, code);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Update user status
    if (type === "email_verify") {
      await db
        .update(users)
        .set({ isEmailVerified: true })
        .where(eq(users.email, cleanId));
    } else if (type === "phone_otp") {
      await db
        .update(users)
        .set({ isPhoneVerified: true })
        .where(eq(users.phone, cleanId));
    }

    return NextResponse.json({
      success: true,
      message: "Verification completed successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
