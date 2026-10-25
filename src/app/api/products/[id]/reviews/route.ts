import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { productReviews, users, orders, orderItems, products } from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const submitReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be between 1 and 5 stars").max(5, "Rating cannot exceed 5 stars"),
  reviewTitle: z.string().max(100, "Title cannot exceed 100 characters").optional().default(""),
  reviewText: z.string().min(5, "Review explanation must be at least 5 characters").max(1000, "Maximum 1000 characters"),
  orderId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: productId } = params;
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;
    const sort = searchParams.get("sort") || "newest"; // "newest" | "highest" | "lowest"

    // Fetch published reviews for this product
    const allPublished = await db
      .select({
        review: productReviews,
        user: {
          id: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(productReviews)
      .innerJoin(users, eq(productReviews.customerId, users.id))
      .where(
        and(
          eq(productReviews.productId, productId),
          eq(productReviews.status, "published")
        )
      );

    // Calculate rating summary on all published reviews
    const totalReviews = allPublished.length;
    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;

    for (const r of allPublished) {
      const star = Math.min(5, Math.max(1, r.review.rating));
      distribution[star] = (distribution[star] || 0) + 1;
      sumRating += star;
    }

    const averageRating =
      totalReviews > 0 ? Math.round((sumRating / totalReviews) * 10) / 10 : 0;

    // Apply sorting
    const sorted = [...allPublished].sort((a, b) => {
      if (sort === "highest") {
        return b.review.rating - a.review.rating || b.review.createdAt - a.review.createdAt;
      } else if (sort === "lowest") {
        return a.review.rating - b.review.rating || b.review.createdAt - a.review.createdAt;
      }
      return b.review.createdAt - a.review.createdAt;
    });

    const paginated = sorted.slice(offset, offset + limit);

    const formattedReviews = paginated.map((r) => {
      const nameParts = (r.user.fullName || "Customer").trim().split(" ");
      const displayName =
        nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
          : nameParts[0];

      return {
        id: r.review.id,
        rating: r.review.rating,
        reviewTitle: r.review.reviewTitle,
        reviewText: r.review.reviewText,
        isVerifiedPurchase: r.review.isVerifiedPurchase,
        createdAt: r.review.createdAt,
        customerName: displayName,
        customerAvatar: r.user.avatarUrl,
      };
    });

    // Check current user's review and purchase eligibility
    let userReview = null;
    let isEligible = false;
    let eligibilityReason = "Please log in to check review eligibility.";
    let eligibleOrderId: string | null = null;
    let userBlocked = false;

    const auth = await getAuthSession();
    if (auth?.user) {
      if (auth.user.status === "blocked") {
        userBlocked = true;
        eligibilityReason = "Your account is restricted. You cannot submit reviews.";
      } else {
        // Check for existing review
        const existing = await db
          .select()
          .from(productReviews)
          .where(
            and(
              eq(productReviews.productId, productId),
              eq(productReviews.customerId, auth.user.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          userReview = existing[0];
        }

        // Check for any completed/collected order containing this product
        const completedOrders = await db
          .select({
            orderId: orders.id,
            orderStatus: orders.orderStatus,
            deliveryType: orders.deliveryType,
          })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .where(
            and(
              eq(orders.customerId, auth.user.id),
              eq(orderItems.productId, productId),
              eq(orders.orderStatus, "completed")
            )
          )
          .limit(1);

        if (completedOrders.length > 0) {
          isEligible = true;
          eligibleOrderId = completedOrders[0].orderId;
          eligibilityReason = "Eligible to review this delivered/collected product.";
        } else {
          // Check if there is an in-progress or pending order
          const inProgressOrders = await db
            .select({
              orderId: orders.id,
              orderStatus: orders.orderStatus,
              deliveryType: orders.deliveryType,
            })
            .from(orders)
            .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
            .where(
              and(
                eq(orders.customerId, auth.user.id),
                eq(orderItems.productId, productId)
              )
            )
            .limit(1);

          if (inProgressOrders.length > 0) {
            const st = inProgressOrders[0].orderStatus;
            const isPickup = inProgressOrders[0].deliveryType === "store_pickup";
            eligibilityReason = isPickup
              ? `Review will be available after counter collection (current status: ${st.replace(/_/g, " ")}).`
              : `Review will be available after delivery is completed (current status: ${st.replace(/_/g, " ")}).`;
          } else {
            eligibilityReason = "Only verified customers who purchased and received this product can submit a review.";
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        totalReviews,
        totalPages: Math.ceil(totalReviews / limit) || 1,
      },
      summary: {
        averageRating,
        totalReviews,
        distribution,
      },
      userReview,
      isEligible,
      eligibilityReason,
      eligibleOrderId,
      userBlocked,
      authenticated: !!auth?.user,
    });
  } catch (error: any) {
    console.error("Fetch reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product reviews." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json(
        { error: "Please log in to submit a review." },
        { status: 401 }
      );
    }

    if (auth.user.status === "blocked") {
      return NextResponse.json(
        { error: "Your account is restricted. You cannot submit reviews." },
        { status: 403 }
      );
    }

    const { id: productId } = params;

    // Verify product exists
    const prodRows = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (prodRows.length === 0) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const validation = submitReviewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { rating, reviewTitle, reviewText, orderId } = validation.data;

    // Strict Backend Eligibility Check:
    // 1. If an orderId was supplied, verify it belongs to user, has this product, and is 'completed'
    // 2. Otherwise find an eligible completed order for this customer and product.
    let eligibleOrder: { id: string; orderStatus: string; deliveryType: string } | null = null;

    if (orderId) {
      const specificRows = await db
        .select({
          id: orders.id,
          orderStatus: orders.orderStatus,
          deliveryType: orders.deliveryType,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.customerId, auth.user.id),
            eq(orderItems.productId, productId)
          )
        )
        .limit(1);

      if (specificRows.length === 0) {
        return NextResponse.json(
          { error: "Order not found or does not contain this product." },
          { status: 404 }
        );
      }

      if (specificRows[0].orderStatus !== "completed") {
        const isPickup = specificRows[0].deliveryType === "store_pickup";
        return NextResponse.json(
          {
            error: isPickup
              ? "Reviews can only be submitted after your order has been collected at the studio counter."
              : "Reviews can only be submitted after your order has been successfully delivered.",
          },
          { status: 403 }
        );
      }

      eligibleOrder = specificRows[0];
    } else {
      // Find any completed order for this customer & product
      const completedRows = await db
        .select({
          id: orders.id,
          orderStatus: orders.orderStatus,
          deliveryType: orders.deliveryType,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orders.customerId, auth.user.id),
            eq(orderItems.productId, productId),
            eq(orders.orderStatus, "completed")
          )
        )
        .limit(1);

      if (completedRows.length > 0) {
        eligibleOrder = completedRows[0];
      } else {
        // Check if there is an order that is not yet completed
        const uncompletedRows = await db
          .select({
            id: orders.id,
            orderStatus: orders.orderStatus,
            deliveryType: orders.deliveryType,
          })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .where(
            and(
              eq(orders.customerId, auth.user.id),
              eq(orderItems.productId, productId)
            )
          )
          .limit(1);

        if (uncompletedRows.length > 0) {
          const isPickup = uncompletedRows[0].deliveryType === "store_pickup";
          return NextResponse.json(
            {
              error: isPickup
                ? "Reviews can only be submitted after your order has been collected at the studio counter."
                : "Reviews can only be submitted after your order has been successfully delivered.",
            },
            { status: 403 }
          );
        }

        return NextResponse.json(
          {
            error:
              "Review submission is restricted to verified customers who have received this product through a completed order.",
          },
          { status: 403 }
        );
      }
    }

    const now = Date.now();

    // Check for existing review (upsert to prevent duplicate reviews)
    const existing = await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.productId, productId),
          eq(productReviews.customerId, auth.user.id)
        )
      )
      .limit(1);

    let reviewId: string;

    if (existing.length > 0) {
      reviewId = existing[0].id;
      await db
        .update(productReviews)
        .set({
          rating,
          reviewTitle: reviewTitle.trim() || null,
          reviewText: reviewText.trim(),
          isVerifiedPurchase: true,
          orderId: eligibleOrder.id,
          status: "published",
          updatedAt: now,
        })
        .where(eq(productReviews.id, reviewId));
    } else {
      reviewId = `rev_${crypto.randomUUID()}`;
      await db.insert(productReviews).values({
        id: reviewId,
        productId,
        customerId: auth.user.id,
        orderId: eligibleOrder.id,
        rating,
        reviewTitle: reviewTitle.trim() || null,
        reviewText: reviewText.trim(),
        isVerifiedPurchase: true,
        status: "published",
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Thank you! Your verified customer review has been submitted and published.",
      reviewId,
      isVerifiedPurchase: true,
    });
  } catch (error: any) {
    console.error("Submit review error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit review." },
      { status: 500 }
    );
  }
}
