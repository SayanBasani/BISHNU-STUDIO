import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  orders,
  orderItems,
  orderFiles,
  payments,
  paymentSubmissions,
  orderReturns,
  productReviews,
  notifications,
  userAddresses,
  sessions,
} from "@/db/schema";
import { and, ne, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    // Strict Production Check: NEVER allow dev cleanup in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Development data cleanup is strictly forbidden in production environments.",
        },
        { status: 403 }
      );
    }

    const isExplicitEnabled =
      process.env.ENABLE_DEV_DATA_CLEANUP === "true" ||
      process.env.ENABLE_DEV_DATA_CLEANUP === "1" ||
      process.env.NODE_ENV === "development";

    if (!isExplicitEnabled) {
      return NextResponse.json(
        {
          error:
            "Development data cleanup is disabled. Set ENABLE_DEV_DATA_CLEANUP=true in .env.local.",
        },
        { status: 403 }
      );
    }

    const configAdminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

    // Query non-admin customers
    const customerRows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ne(users.id, "usr_admin_001"),
          ne(users.role, "admin"),
          ne(users.email, configAdminEmail)
        )
      );

    const nonAdminIds = customerRows.map((c) => c.id);

    // Live counts
    const [allOrders, allItems, allFiles, allSubmissions, allPayments, allReviews, allNotifs] =
      await Promise.all([
        db.select({ id: orders.id }).from(orders),
        db.select({ id: orderItems.id }).from(orderItems),
        db.select({ id: orderFiles.id }).from(orderFiles),
        db.select({ id: paymentSubmissions.id }).from(paymentSubmissions),
        db.select({ id: payments.id }).from(payments),
        db.select({ id: productReviews.id }).from(productReviews),
        db.select({ id: notifications.id }).from(notifications),
      ]);

    let returnsCount = 0;
    try {
      const returnsRows = await db.select({ id: orderReturns.id }).from(orderReturns);
      returnsCount = returnsRows.length;
    } catch {}

    // Count physical private files
    const uploadRoot = path.resolve(
      process.cwd(),
      process.env.LOCAL_UPLOAD_DIR || "./uploads"
    );
    const privateDirs = [
      path.join(uploadRoot, "private", "documents"),
      path.join(uploadRoot, "private", "payments"),
      path.join(uploadRoot, "private", "pvc"),
      path.join(uploadRoot, "private", "photos"),
    ];

    let uploadedFilesCount = 0;
    for (const pDir of privateDirs) {
      if (fs.existsSync(pDir)) {
        try {
          const files = fs.readdirSync(pDir);
          uploadedFilesCount += files.filter((f) =>
            fs.statSync(path.join(pDir, f)).isFile()
          ).length;
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV || "development",
      counts: {
        customers: customerRows.length,
        orders: allOrders.length,
        orderItems: allItems.length,
        orderFiles: allFiles.length,
        paymentSubmissions: allSubmissions.length,
        payments: allPayments.length,
        returns: returnsCount,
        productReviews: allReviews.length,
        notifications: allNotifs.length,
        uploadedFiles: uploadedFilesCount,
      },
      preserved: [
        "Administrator master user account (usr_admin_001 / admin@bishnustudio.com)",
        "Database schema structure & Drizzle migration state",
        "Store profile & system configuration (address, operational hours, contacts)",
        "Base product catalog, categories, service definitions & pricing rates",
        "Shop UPI receiving accounts",
        "Public catalog product photography",
        ".env.local and server credentials configuration",
      ],
    });
  } catch (error: any) {
    console.error("Dev cleanup preview error:", error);
    return NextResponse.json(
      { error: "Failed to generate development data cleanup preview" },
      { status: 500 }
    );
  }
}
