import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userAddresses } from "@/db/schema";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").toLowerCase(),
  phone: z.string().regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100),
  address: z.object({
    houseBuilding: z.string().min(1, "House/Building is required"),
    streetLocality: z.string().min(1, "Street/Locality is required"),
    cityTown: z.string().min(1, "City/Town is required"),
    state: z.string().min(1, "State is required"),
    pinCode: z.string().regex(/^[0-9]{6}$/, "PIN Code must be a 6-digit number"),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = checkRateLimit(ip, "register", { limit: 5, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many registration attempts. Please wait ${rateCheck.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { fullName, email, phone, password, address } = validation.data;

    // Check if email or phone already registered
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.phone, phone)))
      .limit(1);

    if (existing.length > 0) {
      const match = existing[0];
      if (match.email === email) {
        return NextResponse.json(
          { error: "An account with this email address already exists." },
          { status: 409 }
        );
      }
      if (match.phone === phone) {
        return NextResponse.json(
          { error: "An account with this mobile number already exists." },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${crypto.randomUUID()}`;

    await db.insert(users).values({
      id: userId,
      fullName,
      email,
      phone,
      passwordHash,
      role: "customer",
      isEmailVerified: false,
      isPhoneVerified: false,
    });

    // If address provided, create user_addresses record
    if (address) {
      await db.insert(userAddresses).values({
        id: `addr_${crypto.randomUUID()}`,
        userId,
        label: "Home",
        houseBuilding: address.houseBuilding,
        streetLocality: address.streetLocality,
        cityTown: address.cityTown,
        state: address.state,
        pinCode: address.pinCode,
        isDefault: true,
      });
    }

    // Create session and set HTTP-only cookie
    const { sessionToken, expiresAt } = await createSession(userId);
    setSessionCookie(sessionToken, expiresAt);

    await logAuditEvent({
      userId,
      action: "user_registered",
      entityType: "user",
      entityId: userId,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        fullName,
        email,
        phone,
        role: "customer",
        isEmailVerified: false,
        isPhoneVerified: false,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please check your details and try again." },
      { status: 500 }
    );
  }
}
