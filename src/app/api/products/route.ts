import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, productCategories, productImages } from "@/db/schema";
import { eq, like, and, or, sql, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const categorySlug = searchParams.get("category")?.trim();
    const availableOnly = searchParams.get("availableOnly") !== "false";

    let categoryId: string | undefined = undefined;
    if (categorySlug && categorySlug !== "all") {
      const cat = await db
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(eq(productCategories.slug, categorySlug))
        .limit(1);
      if (cat.length > 0) {
        categoryId = cat[0].id;
      }
    }

    const conditions = [];
    if (availableOnly) {
      conditions.push(eq(products.isAvailable, true));
    }
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }
    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.description, `%${search}%`),
          like(products.sku, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const prods = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        categorySlug: productCategories.slug,
        name: products.name,
        slug: products.slug,
        description: products.description,
        price: products.price,
        discountedPrice: products.discountedPrice,
        stockQuantity: products.stockQuantity,
        isAvailable: products.isAvailable,
        sku: products.sku,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(whereClause);

    // Fetch images only for matching products to prevent loading entire table
    const prodIds = prods.map((p) => p.id);
    let images: any[] = [];
    if (prodIds.length > 0) {
      images = await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, prodIds));
    }

    const result = prods.map((prod) => {
      const prodImages = images
        .filter((img) => img.productId === prod.id)
        .sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) {
            return b.isPrimary ? 1 : -1;
          }
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
      return {
        ...prod,
        images: prodImages.map((i) => i.imageUrl),
        imageList: prodImages.map((i) => ({
          id: i.id,
          imageUrl: i.imageUrl,
          isPrimary: i.isPrimary,
          sortOrder: i.sortOrder,
        })),
        primaryImage: prodImages[0]?.imageUrl || "/placeholder-product.png",
      };
    });

    const categories = await db
      .select()
      .from(productCategories)
      .orderBy(productCategories.sortOrder);

    const headers: Record<string, string> = {};
    if (!search && availableOnly) {
      headers["Cache-Control"] = "public, s-maxage=60, stale-while-revalidate=300";
    } else {
      headers["Cache-Control"] = "no-store";
    }

    return NextResponse.json(
      {
        success: true,
        products: result,
        categories,
      },
      { headers }
    );
  } catch (error: any) {
    console.error("Fetch products failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
