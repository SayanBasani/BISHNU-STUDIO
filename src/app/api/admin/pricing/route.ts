import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { services, servicePrices, serviceOptions } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updatePriceSchema = z.object({
  priceId: z.string().min(1, "Price ID is required"),
  price: z
    .number({ invalid_type_error: "Price must be a valid number" })
    .min(0, "Price cannot be negative")
    .refine((val) => Number.isFinite(val), "Price must be a finite number"),
  unit: z.string().optional(),
  minQuantity: z.number().int().min(1).optional(),
  maxQuantity: z.number().int().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const allServices = await db.select().from(services);
    const allOptions = await db.select().from(serviceOptions);
    const allPrices = await db.select().from(servicePrices);

    // Group options and prices by service
    const catalog = allServices.map((srv) => {
      const srvOptions = allOptions
        .filter((o) => o.serviceId === srv.id && o.isActive)
        .map((opt) => {
          const priceRec = allPrices.find((p) => p.optionId === opt.id);
          return {
            id: opt.id,
            group: opt.optionGroup,
            key: opt.optionKey,
            name: opt.optionName,
            metadata: opt.metadataJson ? JSON.parse(opt.metadataJson) : null,
            price: priceRec ? priceRec.price : null,
            unit: priceRec?.unit || "per_unit",
            minQuantity: priceRec?.minQuantity ?? 1,
            maxQuantity: priceRec?.maxQuantity ?? 1000,
            priceId: priceRec?.id || null,
            updatedAt: priceRec?.updatedAt || null,
          };
        });

      return {
        ...srv,
        options: srvOptions,
      };
    });

    return NextResponse.json({ success: true, services: catalog });
  } catch (error: any) {
    console.error("Admin pricing GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing rates." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = updatePriceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { priceId, price, unit, minQuantity, maxQuantity } = validation.data;

    // Validate quantity tiers if both supplied
    if (minQuantity !== undefined && maxQuantity !== undefined && maxQuantity < minQuantity) {
      return NextResponse.json(
        { error: "Max quantity cannot be less than min quantity." },
        { status: 400 }
      );
    }

    // Get current record for audit log
    const existing = await db
      .select()
      .from(servicePrices)
      .where(eq(servicePrices.id, priceId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Service price record not found." },
        { status: 404 }
      );
    }

    const oldRecord = existing[0];
    const oldPrice = oldRecord.price;

    // Round to 2 decimal places for precise INR currency handling
    const roundedPrice = Math.round(price * 100) / 100;

    const updates: Partial<typeof servicePrices.$inferInsert> = {
      price: roundedPrice,
      updatedAt: Date.now(),
    };

    if (unit) updates.unit = unit;
    if (minQuantity !== undefined) updates.minQuantity = minQuantity;
    if (maxQuantity !== undefined) updates.maxQuantity = maxQuantity;

    await db
      .update(servicePrices)
      .set(updates)
      .where(eq(servicePrices.id, priceId));

    await logAuditEvent({
      userId: auth.user.id,
      action: "updated_service_price",
      entityType: "pricing",
      entityId: priceId,
      details: {
        serviceId: oldRecord.serviceId,
        optionId: oldRecord.optionId,
        oldPrice,
        newPrice: roundedPrice,
        unit: unit || oldRecord.unit,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Price successfully updated to ₹${roundedPrice}`,
      price: roundedPrice,
    });
  } catch (error: any) {
    console.error("Admin pricing PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update service price." },
      { status: 500 }
    );
  }
}
