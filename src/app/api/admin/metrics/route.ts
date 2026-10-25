import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orders, products, users, auditLogs } from "@/db/schema";
import { eq, desc, lt, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // High performance SQL aggregates executed concurrently, eliminating full-table memory scans
    const [metricsResult, lowStockProducts, recentOrders, recentLogs] = await Promise.all([
      db
        .select({
          totalOrders: sql<number>`count(*)`,
          pendingOrders: sql<number>`count(case when ${orders.orderStatus} = 'pending' then 1 end)`,
          processingOrders: sql<number>`count(case when ${orders.orderStatus} = 'processing' then 1 end)`,
          readyOrders: sql<number>`count(case when ${orders.orderStatus} = 'ready_for_collection' then 1 end)`,
          completedOrders: sql<number>`count(case when ${orders.orderStatus} = 'completed' then 1 end)`,
          totalRevenue: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' then ${orders.totalAmount} else 0 end), 0)`,
          pendingRevenue: sql<number>`coalesce(sum(case when ${orders.paymentStatus} in ('pending', 'unpaid') and ${orders.orderStatus} != 'cancelled' then ${orders.totalAmount} else 0 end), 0)`,
        })
        .from(orders),
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          stockQuantity: products.stockQuantity,
        })
        .from(products)
        .where(lt(products.stockQuantity, 30))
        .limit(10),
      db
        .select({
          id: orders.id,
          orderReference: orders.orderReference,
          orderType: orders.orderType,
          totalAmount: orders.totalAmount,
          orderStatus: orders.orderStatus,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(8),
      db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(10),
    ]);

    const m = metricsResult[0] || {};
    const totalOrders = Number(m.totalOrders) || 0;
    const pendingOrders = Number(m.pendingOrders) || 0;
    const processingOrders = Number(m.processingOrders) || 0;
    const readyOrders = Number(m.readyOrders) || 0;
    const completedOrders = Number(m.completedOrders) || 0;
    const totalRevenue = Number(m.totalRevenue) || 0;
    const pendingRevenue = Number(m.pendingRevenue) || 0;

    return NextResponse.json({
      success: true,
      metrics: {
        totalOrders,
        pendingOrders,
        processingOrders,
        readyOrders,
        completedOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        pendingRevenue: Math.round(pendingRevenue * 100) / 100,
      },
      lowStockProducts,
      recentOrders,
      recentLogs,
    });
  } catch (error) {
    console.error("Admin metrics error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
