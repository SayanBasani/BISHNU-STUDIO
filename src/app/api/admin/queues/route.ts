import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orders, orderItems, orderFiles, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemType = searchParams.get("type"); // pvc_card, document_print, photo_print, lamination

    if (!itemType) {
      return NextResponse.json(
        { error: "Query parameter 'type' is required." },
        { status: 400 }
      );
    }

    // Query items of this type
    const items = await db
      .select({
        itemId: orderItems.id,
        itemType: orderItems.itemType,
        quantity: orderItems.quantity,
        pageCount: orderItems.pageCount,
        unitPriceSnapshot: orderItems.unitPriceSnapshot,
        totalPriceSnapshot: orderItems.totalPriceSnapshot,
        specialInstructions: orderItems.specialInstructions,
        configurationJson: orderItems.configurationJson,
        createdAt: orderItems.createdAt,
        orderId: orders.id,
        orderReference: orders.orderReference,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        deliveryType: orders.deliveryType,
        customerName: users.fullName,
        customerPhone: users.phone,
        customerEmail: users.email,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(eq(orderItems.itemType, itemType as any))
      .orderBy(desc(orders.createdAt));

    // Fetch all files associated with these items
    const allFiles = await db
      .select({
        id: orderFiles.id,
        orderItemId: orderFiles.orderItemId,
        originalFilename: orderFiles.originalFilename,
        fileSize: orderFiles.fileSize,
        mimeType: orderFiles.mimeType,
        fileCategory: orderFiles.fileCategory,
        pageCount: orderFiles.pageCount,
      })
      .from(orderFiles);

    const enrichedItems = items.map((item) => {
      let config = {};
      try {
        config = JSON.parse(item.configurationJson || "{}");
      } catch {}

      const files = allFiles
        .filter((f) => f.orderItemId === item.itemId)
        .map((f) => ({
          ...f,
          downloadUrl: `/api/files/download/${f.id}`,
        }));

      return {
        ...item,
        configuration: config,
        files,
      };
    });

    return NextResponse.json({
      success: true,
      items: enrichedItems,
    });
  } catch (error: any) {
    console.error("Queue fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue items." },
      { status: 500 }
    );
  }
}
