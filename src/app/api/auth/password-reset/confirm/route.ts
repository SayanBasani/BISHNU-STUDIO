import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, code, newPassword } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    const verifyResult = await verifyOtp(cleanEmail, "password_reset", code);
    if (!verifyResult.success) {
      return NextResponse.json({ error: verifyResult.error }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.email, cleanEmail));

    return NextResponse.json({
      success: true,
      message: "Password has been successfully reset. You can now log in.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
