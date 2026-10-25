import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { productReviews } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";

const moderationSchema = z.object({
  action: z.enum(["hide", "publish"]),
  reason: z.string().optional().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const validation = moderationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, reason } = validation.data;
    const now = Date.now();
    const newStatus = action === "hide" ? "hidden" : "published";

    await db
      .update(productReviews)
      .set({
        status: newStatus,
        moderationReason: reason.trim() || (action === "hide" ? "Hidden by administrator" : null),
        moderatedByAdminId: auth.user.id,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(eq(productReviews.id, id));

    await logAuditEvent({
      userId: auth.user.id,
      action: action === "hide" ? "hide_review" : "publish_review",
      entityType: "product_review",
      entityId: id,
      details: { reason },
    });

    return NextResponse.json({
      success: true,
      message: action === "hide" ? "Review hidden from storefront." : "Review published to storefront.",
      status: newStatus,
    });
  } catch (error: any) {
    console.error("Review moderation error:", error);
    return NextResponse.json(
      { error: "Failed to moderate review." },
      { status: 500 }
    );
  }
}
