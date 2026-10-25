import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, accountAppeals } from "@/db/schema";
import { eq, and, or, gt, desc } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const appealSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  contactEmail: z.string().email("Valid email address is required"),
  contactPhone: z.string().min(10, "Valid 10-digit phone number is required").max(15),
  category: z.enum(["spam", "abusive", "fraud", "misuse", "other"]).default("other"),
  message: z.string().min(10, "Appeal explanation must be at least 10 characters").max(1000, "Maximum 1000 characters"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const contactEmail = searchParams.get("email");

    if (!userId && !contactEmail) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    let appealsList;
    if (userId) {
      appealsList = await db
        .select()
        .from(accountAppeals)
        .where(eq(accountAppeals.userId, userId))
        .orderBy(desc(accountAppeals.createdAt));
    } else {
      appealsList = await db
        .select()
        .from(accountAppeals)
        .where(eq(accountAppeals.contactEmail, contactEmail!.toLowerCase()))
        .orderBy(desc(accountAppeals.createdAt));
    }

    return NextResponse.json({
      success: true,
      appeals: appealsList,
      latestAppeal: appealsList[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch appeal history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await req.json().catch(() => ({}));
    const validation = appealSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { userId, contactEmail, contactPhone, category, message } = validation.data;
    const cleanEmail = contactEmail.trim().toLowerCase();
    const cleanPhone = contactPhone.trim();

    // Verify user exists
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const user = userRows[0];
    if (user.status !== "blocked") {
      return NextResponse.json(
        { error: "This account is not restricted. You can log in normally." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    const thirtySecondsAgo = now - 30 * 1000;

    // 1. IP rate check: Max 10 per 15 minutes
    const ipAppeals = await db
      .select({ id: accountAppeals.id })
      .from(accountAppeals)
      .where(
        and(
          eq(accountAppeals.ipAddress, ip),
          gt(accountAppeals.createdAt, fifteenMinutesAgo)
        )
      );
    if (ipAppeals.length >= 10) {
      return NextResponse.json(
        { error: "Too many appeal submissions from this network. Please wait 15 minutes." },
        { status: 429 }
      );
    }

    // 2. Minimum 30s gap for this userId
    const veryRecent = await db
      .select({ id: accountAppeals.id })
      .from(accountAppeals)
      .where(
        and(
          eq(accountAppeals.userId, userId),
          gt(accountAppeals.createdAt, thirtySecondsAgo)
        )
      );
    if (veryRecent.length > 0) {
      return NextResponse.json(
        { error: "Please wait at least 30 seconds between appeal submissions." },
        { status: 429 }
      );
    }

    // 3. User 24h limit: Max 2 appeals per account per 24 hours
    const userDailyAppeals = await db
      .select({ id: accountAppeals.id })
      .from(accountAppeals)
      .where(
        and(
          eq(accountAppeals.userId, userId),
          gt(accountAppeals.createdAt, twentyFourHoursAgo)
        )
      );
    if (userDailyAppeals.length >= 2) {
      return NextResponse.json(
        { error: "You have reached the maximum of 2 appeals per 24 hours. Please await administrator review." },
        { status: 429 }
      );
    }

    // 4. Contact email/phone limit: Max 5 appeals per 24 hours
    const contactDailyAppeals = await db
      .select({ id: accountAppeals.id })
      .from(accountAppeals)
      .where(
        and(
          or(
            eq(accountAppeals.contactEmail, cleanEmail),
            eq(accountAppeals.contactPhone, cleanPhone)
          ),
          gt(accountAppeals.createdAt, twentyFourHoursAgo)
        )
      );
    if (contactDailyAppeals.length >= 5) {
      return NextResponse.json(
        { error: "Maximum appeals limit reached for this contact information." },
        { status: 429 }
      );
    }

    // 5. Check if an appeal is already pending (submitted or under_review)
    const pendingAppeals = await db
      .select()
      .from(accountAppeals)
      .where(
        and(
          eq(accountAppeals.userId, userId),
          or(
            eq(accountAppeals.status, "submitted"),
            eq(accountAppeals.status, "under_review")
          )
        )
      )
      .limit(1);

    if (pendingAppeals.length > 0) {
      return NextResponse.json(
        {
          error: "You already have an appeal under review. Please allow 24-48 hours for review.",
          existingAppeal: pendingAppeals[0],
        },
        { status: 400 }
      );
    }

    const appealId = `app_${crypto.randomUUID()}`;
    await db.insert(accountAppeals).values({
      id: appealId,
      userId,
      contactEmail: cleanEmail,
      contactPhone: cleanPhone,
      category,
      message: message.trim(),
      status: "submitted",
      ipAddress: ip,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      message: "Your appeal has been submitted successfully. Estimated review timeframe is 24-48 business hours.",
      appealId,
    });
  } catch (error: any) {
    console.error("Submit appeal error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit appeal." },
      { status: 500 }
    );
  }
}
