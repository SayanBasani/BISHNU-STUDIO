import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, productCategories, productImages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const prodRows = await db
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
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(eq(products.id, id))
      .limit(1);

    if (prodRows.length === 0) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const prod = prodRows[0];
    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(productImages.sortOrder);

    const primaryImgUrl =
      images.find((img) => img.isPrimary)?.imageUrl ||
      images[0]?.imageUrl ||
      "/placeholder-product.png";

    return NextResponse.json({
      success: true,
      product: {
        ...prod,
        images: images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
        })),
        primaryImage: primaryImgUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve product details." },
      { status: 500 }
    );
  }
}
