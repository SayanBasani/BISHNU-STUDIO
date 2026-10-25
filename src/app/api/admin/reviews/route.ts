import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { productReviews, products, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewRows = await db
      .select({
        review: productReviews,
        product: {
          id: products.id,
          name: products.name,
          sku: products.sku,
        },
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(productReviews)
      .innerJoin(products, eq(productReviews.productId, products.id))
      .innerJoin(users, eq(productReviews.customerId, users.id))
      .orderBy(desc(productReviews.createdAt));

    const formatted = reviewRows.map((row) => ({
      ...row.review,
      product: row.product,
      user: row.user,
    }));

    return NextResponse.json({
      success: true,
      reviews: formatted,
    });
  } catch (error: any) {
    console.error("Admin reviews list error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve product reviews." },
      { status: 500 }
    );
  }
}
