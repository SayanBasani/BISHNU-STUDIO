import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { userAddresses } from "@/db/schema";
import { recordMutationIfInFallback } from "@/lib/db-sync";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateAddressSchema = z.object({
  recipientName: z.string().min(2, "Recipient name must be at least 2 characters").optional(),
  recipientPhone: z
    .string()
    .regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number")
    .optional(),
  addressType: z.enum(["home", "work", "other"]).optional(),
  houseBuilding: z.string().min(1, "House / Flat / Building is required").optional(),
  streetLocality: z.string().min(1, "Street / Locality is required").optional(),
  landmark: z.string().optional().nullable(),
  cityTown: z.string().min(1, "City / Town is required").optional(),
  state: z.string().min(1, "State is required").optional(),
  pinCode: z.string().regex(/^[0-9]{6}$/, "Please enter a valid 6-digit PIN code").optional(),
  isDefault: z.boolean().optional(),
});

// PUT /api/account/addresses/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const validation = updateAddressSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, auth.user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    const data = validation.data;

    if (data.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, auth.user.id));
    }

    const updatePayload: Record<string, any> = {};
    if (data.recipientName !== undefined) updatePayload.recipientName = data.recipientName.trim();
    if (data.recipientPhone !== undefined) updatePayload.recipientPhone = data.recipientPhone.trim();
    if (data.addressType !== undefined) {
      updatePayload.addressType = data.addressType;
      updatePayload.label = data.addressType.charAt(0).toUpperCase() + data.addressType.slice(1);
    }
    if (data.houseBuilding !== undefined) updatePayload.houseBuilding = data.houseBuilding.trim();
    if (data.streetLocality !== undefined) updatePayload.streetLocality = data.streetLocality.trim();
    if (data.landmark !== undefined) updatePayload.landmark = data.landmark?.trim() || null;
    if (data.cityTown !== undefined) updatePayload.cityTown = data.cityTown.trim();
    if (data.state !== undefined) updatePayload.state = data.state.trim();
    if (data.pinCode !== undefined) updatePayload.pinCode = data.pinCode.trim();
    if (data.isDefault !== undefined) updatePayload.isDefault = data.isDefault;

    await db
      .update(userAddresses)
      .set(updatePayload)
      .where(eq(userAddresses.id, id));

    await recordMutationIfInFallback(db, {
      entityType: "user_addresses",
      entityId: id,
      operation: "UPDATE",
      payload: {
        id,
        ...updatePayload,
      },
    });

    const updated = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      address: updated[0],
      message: "Address updated successfully.",
    });
  } catch (error: any) {
    console.error("Update address error:", error);
    return NextResponse.json(
      { error: "Failed to update address." },
      { status: 500 }
    );
  }
}

// DELETE /api/account/addresses/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const existing = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, auth.user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    const wasDefault = existing[0].isDefault;
    await db.delete(userAddresses).where(eq(userAddresses.id, id));

    await recordMutationIfInFallback(db, {
      entityType: "user_addresses",
      entityId: id,
      operation: "DELETE",
      payload: { id },
    });

    // If deleted address was default, promote another address to default
    if (wasDefault) {
      const remaining = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, auth.user.id))
        .limit(1);

      if (remaining.length > 0) {
        await db
          .update(userAddresses)
          .set({ isDefault: true })
          .where(eq(userAddresses.id, remaining[0].id));
      }
    }

    return NextResponse.json({
      success: true,
      message: "Address removed successfully.",
    });
  } catch (error: any) {
    console.error("Delete address error:", error);
    return NextResponse.json(
      { error: "Failed to delete address." },
      { status: 500 }
    );
  }
}

// PATCH /api/account/addresses/[id]/default or PATCH here to set default
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const existing = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, auth.user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    // Set all user addresses to isDefault = false
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, auth.user.id));

    // Set this address to isDefault = true
    await db
      .update(userAddresses)
      .set({ isDefault: true })
      .where(eq(userAddresses.id, id));

    return NextResponse.json({
      success: true,
      message: "Default address updated.",
    });
  } catch (error: any) {
    console.error("Set default address error:", error);
    return NextResponse.json(
      { error: "Failed to update default address." },
      { status: 500 }
    );
  }
}
