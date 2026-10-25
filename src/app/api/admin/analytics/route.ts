import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orders, orderItems, products, users } from "@/db/schema";
import { eq, sql, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run targeted database aggregates in parallel, preventing unbounded table loading
    const [
      revenueRows,
      customerCountRows,
      statusGroupRows,
      deliveryGroupRows,
      serviceGroupRows,
      topProductRows,
    ] = await Promise.all([
      db
        .select({
          totalOrders: sql<number>`count(*)`,
          totalRevenue: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' then ${orders.totalAmount} else 0 end), 0)`,
          pendingRevenue: sql<number>`coalesce(sum(case when ${orders.paymentStatus} != 'paid' and ${orders.orderStatus} != 'cancelled' then ${orders.totalAmount} else 0 end), 0)`,
        })
        .from(orders),

      db
        .select({
          totalCustomers: sql<number>`count(*)`,
        })
        .from(users)
        .where(eq(users.role, "customer")),

      db
        .select({
          status: orders.orderStatus,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .groupBy(orders.orderStatus),

      db
        .select({
          deliveryType: orders.deliveryType,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .groupBy(orders.deliveryType),

      db
        .select({
          itemType: orderItems.itemType,
          total: sql<number>`coalesce(sum(${orderItems.totalPriceSnapshot}), 0)`,
          count: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
        })
        .from(orderItems)
        .groupBy(orderItems.itemType),

      db
        .select({
          productId: orderItems.productId,
          quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
          revenue: sql<number>`coalesce(sum(${orderItems.totalPriceSnapshot}), 0)`,
        })
        .from(orderItems)
        .where(eq(orderItems.itemType, "product"))
        .groupBy(orderItems.productId)
        .orderBy(desc(sql`revenue`))
        .limit(5),
    ]);

    const rev = revenueRows[0] || {};
    const totalOrders = Number(rev.totalOrders) || 0;
    const totalRevenue = Number(rev.totalRevenue) || 0;
    const pendingRevenue = Number(rev.pendingRevenue) || 0;
    const totalCustomers = Number(customerCountRows[0]?.totalCustomers) || 0;

    // Build status breakdown map
    const ordersByStatus: Record<string, number> = {};
    for (const row of statusGroupRows) {
      if (row.status) ordersByStatus[row.status] = Number(row.count) || 0;
    }

    // Build delivery breakdown map
    const deliveryBreakdown: Record<string, number> = {
      store_pickup: 0,
      home_delivery: 0,
    };
    for (const row of deliveryGroupRows) {
      if (row.deliveryType) deliveryBreakdown[row.deliveryType] = Number(row.count) || 0;
    }

    // Build service revenue map
    const serviceRevenue: Record<string, { total: number; count: number }> = {
      product: { total: 0, count: 0 },
      pvc_card: { total: 0, count: 0 },
      document_print: { total: 0, count: 0 },
      photo_print: { total: 0, count: 0 },
      lamination: { total: 0, count: 0 },
    };

    for (const row of serviceGroupRows) {
      const type = row.itemType || "product";
      serviceRevenue[type] = {
        total: Number(row.total) || 0,
        count: Number(row.count) || 0,
      };
    }

    // Fetch product names for top products
    const validProductIds = topProductRows
      .map((r) => r.productId)
      .filter((id): id is string => Boolean(id));

    let topProducts: Array<{ name: string; quantity: number; revenue: number }> = [];
    if (validProductIds.length > 0) {
      const prodDetails = await db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(inArray(products.id, validProductIds));

      const nameMap = new Map(prodDetails.map((p) => [p.id, p.name]));

      topProducts = topProductRows.map((row) => ({
        name: (row.productId && nameMap.get(row.productId)) || "Product",
        quantity: Number(row.quantity) || 0,
        revenue: Number(row.revenue) || 0,
      }));
    }

    return NextResponse.json({
      success: true,
      analytics: {
        totalOrders,
        totalRevenue,
        pendingRevenue,
        totalCustomers,
        serviceRevenue,
        ordersByStatus,
        deliveryBreakdown,
        topProducts,
      },
    });
  } catch (error: any) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json(
      { error: "Failed to generate analytics." },
      { status: 500 }
    );
  }
}
