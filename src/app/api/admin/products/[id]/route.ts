import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { products, productImages, productCategories } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const imageItemSchema = z.object({
  imageUrl: z.string().url("Valid image URL is required"),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  price: z.number().min(0.01).optional(),
  discountedPrice: z.number().nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(imageItemSchema).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const validation = updateProductSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (validation.data.categoryId) {
      const cat = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, validation.data.categoryId))
        .limit(1);
      if (cat.length === 0) {
        return NextResponse.json({ error: "Category not found" }, { status: 400 });
      }
    }

    const { imageUrl, images, ...updateFields } = validation.data;

    await db
      .update(products)
      .set({
        ...updateFields,
        updatedAt: Date.now(),
      })
      .where(eq(products.id, id));

    if (images !== undefined) {
      // Replace images with new list
      await db.delete(productImages).where(eq(productImages.productId, id));

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await db.insert(productImages).values({
          id: `img_${crypto.randomUUID()}`,
          productId: id,
          imageUrl: img.imageUrl,
          altText: validation.data.name || existing[0].name,
          isPrimary: img.isPrimary ?? (i === 0),
          sortOrder: img.sortOrder ?? i,
        });
      }
    } else if (imageUrl) {
      const currentImages = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, id))
        .limit(1);

      if (currentImages.length > 0) {
        await db
          .update(productImages)
          .set({ imageUrl })
          .where(eq(productImages.id, currentImages[0].id));
      } else {
        await db.insert(productImages).values({
          id: `img_${crypto.randomUUID()}`,
          productId: id,
          imageUrl,
          altText: validation.data.name || existing[0].name,
          isPrimary: true,
          sortOrder: 0,
        });
      }
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "update_product",
      entityType: "product",
      entityId: id,
      details: updateFields,
    });

    return NextResponse.json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}
