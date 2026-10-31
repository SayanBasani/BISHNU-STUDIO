import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { userAddresses } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { createRequestTimer } from "@/lib/perf";
import { recordMutationIfInFallback } from "@/lib/db-sync";

export const dynamic = "force-dynamic";

const addressSchema = z.object({
  recipientName: z.string().min(2, "Recipient name must be at least 2 characters"),
  recipientPhone: z
    .string()
    .regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"),
  addressType: z.enum(["home", "work", "other"]).default("home"),
  houseBuilding: z.string().min(1, "House / Flat / Building is required"),
  streetLocality: z.string().min(1, "Street / Locality is required"),
  landmark: z.string().optional().nullable(),
  cityTown: z.string().min(1, "City / Town is required"),
  state: z.string().min(1, "State is required"),
  pinCode: z.string().regex(/^[0-9]{6}$/, "Please enter a valid 6-digit PIN code"),
  isDefault: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const timer = createRequestTimer(req);
  try {
    const auth = await timer.measure("authentication", async () => {
      return await getAuthSession();
    });

    if (!auth?.user) {
      return timer.finish(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const addresses = await timer.measure("database.user_addresses", async () => {
      return await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, auth.user.id))
        .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));
    });

    return timer.finish(NextResponse.json({ addresses }));
  } catch (error: any) {
    console.error("Fetch addresses error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to fetch saved addresses." },
        { status: 500 }
      )
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = addressSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check existing addresses
    const existing = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, auth.user.id));

    const isFirstAddress = existing.length === 0;
    const makeDefault = data.isDefault || isFirstAddress;

    // If making default, reset existing defaults
    if (makeDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, auth.user.id));
    }

    const newId = `addr_${crypto.randomUUID()}`;
    const addressPayload = {
      id: newId,
      userId: auth.user.id,
      recipientName: data.recipientName.trim(),
      recipientPhone: data.recipientPhone.trim(),
      addressType: data.addressType,
      label:
        data.addressType.charAt(0).toUpperCase() + data.addressType.slice(1),
      houseBuilding: data.houseBuilding.trim(),
      streetLocality: data.streetLocality.trim(),
      landmark: data.landmark?.trim() || null,
      cityTown: data.cityTown.trim(),
      state: data.state.trim(),
      pinCode: data.pinCode.trim(),
      isDefault: makeDefault,
    };

    await db.insert(userAddresses).values(addressPayload);

    await recordMutationIfInFallback(db, {
      entityType: "user_addresses",
      entityId: newId,
      operation: "INSERT",
      payload: addressPayload,
    });

    const created = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, newId))
      .limit(1);

    return NextResponse.json({
      success: true,
      address: created[0],
      message: "Address saved successfully.",
    });
  } catch (error: any) {
    console.error("Create address error:", error);
    return NextResponse.json(
      { error: "Failed to save address." },
      { status: 500 }
    );
  }
}
