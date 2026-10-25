import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { productCategories, products } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  slug: z.string().min(2, "Slug is required"),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await db
      .select()
      .from(productCategories)
      .orderBy(asc(productCategories.sortOrder));

    const allProducts = await db.select({ categoryId: products.categoryId }).from(products);

    const categoriesWithCount = categories.map((cat) => ({
      ...cat,
      productCount: allProducts.filter((p) => p.categoryId === cat.id).length,
    }));

    return NextResponse.json({ categories: categoriesWithCount });
  } catch (error: any) {
    console.error("Categories fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = categorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, slug, description, sortOrder } = validation.data;
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

    const newId = `cat_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(productCategories).values({
      id: newId,
      name: name.trim(),
      slug: cleanSlug,
      description: description?.trim() || null,
      sortOrder,
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "create_category",
      entityType: "product",
      entityId: newId,
      details: { name, slug: cleanSlug },
    });

    return NextResponse.json({
      success: true,
      message: "Category created successfully",
    });
  } catch (error: any) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create category." },
      { status: 500 }
    );
  }
}
