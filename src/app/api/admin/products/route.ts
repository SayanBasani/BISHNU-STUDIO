import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { products, productImages } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { recordMutationIfInFallback } from "@/lib/db-sync";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const imageItemSchema = z.object({
  imageUrl: z.string().url("Valid image URL is required"),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const createProductSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(2, "Product name must be at least 2 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  price: z.number().min(0.01, "Price must be positive"),
  discountedPrice: z.number().optional(),
  stockQuantity: z.number().int().min(0, "Stock cannot be negative"),
  sku: z.string().min(2, "SKU is required"),
  imageUrl: z.string().url().optional(),
  images: z.array(imageItemSchema).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin authorization required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = createProductSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      categoryId,
      name,
      description,
      price,
      discountedPrice,
      stockQuantity,
      sku,
      imageUrl,
      images,
    } = validation.data;

    // Check SKU uniqueness
    const existingSku = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    if (existingSku.length > 0) {
      return NextResponse.json(
        { error: `A product with SKU "${sku}" already exists.` },
        { status: 409 }
      );
    }

    const productId = `prod_${crypto.randomUUID()}`;
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + `-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.insert(products).values({
      id: productId,
      categoryId,
      name,
      slug,
      description,
      price,
      discountedPrice: discountedPrice || null,
      stockQuantity,
      isAvailable: true,
      sku,
    });

    await recordMutationIfInFallback(db, {
      entityType: "products",
      entityId: productId,
      operation: "INSERT",
      payload: {
        id: productId,
        categoryId,
        name,
        slug,
        description,
        price,
        discountedPrice: discountedPrice || null,
        stockQuantity,
        isAvailable: true,
        sku,
      },
    });

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const imgId = `img_${crypto.randomUUID()}`;
        await db.insert(productImages).values({
          id: imgId,
          productId,
          imageUrl: img.imageUrl,
          altText: name,
          isPrimary: img.isPrimary ?? (i === 0),
          sortOrder: img.sortOrder ?? i,
        });

        await recordMutationIfInFallback(db, {
          entityType: "product_images",
          entityId: imgId,
          operation: "INSERT",
          payload: {
            id: imgId,
            productId,
            imageUrl: img.imageUrl,
            altText: name,
            isPrimary: img.isPrimary ?? (i === 0),
            sortOrder: img.sortOrder ?? i,
          },
        });
      }
    } else if (imageUrl) {
      const imgId = `img_${crypto.randomUUID()}`;
      await db.insert(productImages).values({
        id: imgId,
        productId,
        imageUrl,
        altText: name,
        isPrimary: true,
        sortOrder: 0,
      });

      await recordMutationIfInFallback(db, {
        entityType: "product_images",
        entityId: imgId,
        operation: "INSERT",
        payload: {
          id: imgId,
          productId,
          imageUrl,
          altText: name,
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "create_product",
      entityType: "product",
      entityId: productId,
      details: { name, sku, price, stockQuantity },
    });

    return NextResponse.json({
      success: true,
      message: "Product created successfully",
      productId,
    });
  } catch (error: any) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
