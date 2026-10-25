import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/db";
import { users, userAddresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const profileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  address: z
    .object({
      id: z.string().optional(),
      houseBuilding: z.string().min(1),
      streetLocality: z.string().min(1),
      cityTown: z.string().min(1),
      state: z.string().min(1),
      pinCode: z.string().regex(/^[0-9]{6}$/),
    })
    .optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = profileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { fullName, currentPassword, newPassword, address } = validation.data;

    // Password change check
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password." },
          { status: 400 }
        );
      }

      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, auth.user.id))
        .limit(1);

      const isValidCurrent = await verifyPassword(
        currentPassword,
        userRecord[0].passwordHash
      );
      if (!isValidCurrent) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 400 }
        );
      }

      const newHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, auth.user.id));
    }

    if (fullName) {
      await db
        .update(users)
        .set({ fullName })
        .where(eq(users.id, auth.user.id));
    }

    if (address) {
      if (address.id) {
        // Update existing address belonging to user
        await db
          .update(userAddresses)
          .set({
            houseBuilding: address.houseBuilding,
            streetLocality: address.streetLocality,
            cityTown: address.cityTown,
            state: address.state,
            pinCode: address.pinCode,
          })
          .where(eq(userAddresses.id, address.id));
      } else {
        // Create new address
        await db.insert(userAddresses).values({
          id: `addr_${crypto.randomUUID()}`,
          userId: auth.user.id,
          label: "Home",
          houseBuilding: address.houseBuilding,
          streetLocality: address.streetLocality,
          cityTown: address.cityTown,
          state: address.state,
          pinCode: address.pinCode,
          isDefault: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 }
    );
  }
}
