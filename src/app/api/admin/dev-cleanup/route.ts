import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthSession, validateAdminCredentials } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  orders,
  orderItems,
  orderFiles,
  payments,
  paymentSubmissions,
  orderReturns,
  orderReturnItems,
  orderStatusHistory,
  productReviews,
  notifications,
  userAddresses,
  sessions,
  verificationTokens,
  accountAppeals,
  auditLogs,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { and, ne, inArray } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const cleanupRequestSchema = z.object({
  password: z.string().min(1, "Administrator password is required for re-authentication"),
  confirmation: z.literal("WIPE DEVELOPMENT DATA", {
    errorMap: () => ({
      message: "Confirmation phrase must exactly match 'WIPE DEVELOPMENT DATA'",
    }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin authorization required." },
        { status: 403 }
      );
    }

    // 1. Strict Production Guard: NEVER allow dev cleanup in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "CRITICAL SECURITY REJECTION: Development data cleanup is strictly prohibited in production.",
        },
        { status: 403 }
      );
    }

    // 2. Explicit Environment Enablement Guard
    const isExplicitEnabled =
      process.env.ENABLE_DEV_DATA_CLEANUP === "true" ||
      process.env.ENABLE_DEV_DATA_CLEANUP === "1" ||
      process.env.NODE_ENV === "development";

    if (!isExplicitEnabled) {
      return NextResponse.json(
        {
          error:
            "Development data cleanup is disabled. Set ENABLE_DEV_DATA_CLEANUP=true in .env.local to enable.",
        },
        { status: 403 }
      );
    }

    // 3. Request validation
    const body = await req.json();
    const validation = cleanupRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { password } = validation.data;

    // 4. Admin Re-authentication Guard
    const configAdminEmail = (process.env.ADMIN_EMAIL || auth.user.email || "").trim().toLowerCase();
    const authCheck = await validateAdminCredentials(configAdminEmail, password);
    if (!authCheck.valid) {
      await logAuditEvent({
        userId: auth.user.id,
        action: "dev_cleanup_auth_failed",
        entityType: "settings",
        details: {
          ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
          reason: "Invalid password supplied for WIPE DEVELOPMENT DATA",
        },
      });
      return NextResponse.json(
        {
          error:
            "Re-authentication failed: Invalid administrator password. Data cleanup cancelled.",
        },
        { status: 401 }
      );
    }

    // 5. Gather non-admin customer accounts to delete
    const nonAdminUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ne(users.id, "usr_admin_001"),
          ne(users.role, "admin"),
          ne(users.email, configAdminEmail)
        )
      );

    const nonAdminIds = nonAdminUsers.map((u) => u.id);

    // Track deletion metrics
    const deletedCounts = {
      customers: nonAdminIds.length,
      orders: 0,
      orderItems: 0,
      orderFiles: 0,
      paymentSubmissions: 0,
      payments: 0,
      returns: 0,
      productReviews: 0,
      notifications: 0,
      deletedFiles: 0,
    };

    // 6. Delete Returns & Return Items
    try {
      const returnRows = await db.select({ id: orderReturns.id }).from(orderReturns);
      deletedCounts.returns = returnRows.length;
      await db.delete(orderReturnItems);
      await db.delete(orderReturns);
    } catch {}

    // 7. Delete Order Files
    const fileRows = await db.select({ id: orderFiles.id }).from(orderFiles);
    deletedCounts.orderFiles = fileRows.length;
    await db.delete(orderFiles);

    // 8. Delete Payment Submissions & Payments
    const subRows = await db.select({ id: paymentSubmissions.id }).from(paymentSubmissions);
    deletedCounts.paymentSubmissions = subRows.length;
    await db.delete(paymentSubmissions);

    const payRows = await db.select({ id: payments.id }).from(payments);
    deletedCounts.payments = payRows.length;
    await db.delete(payments);

    // 9. Delete Order Status History & Order Items
    await db.delete(orderStatusHistory);

    const itemRows = await db.select({ id: orderItems.id }).from(orderItems);
    deletedCounts.orderItems = itemRows.length;
    await db.delete(orderItems);

    // 10. Delete Orders
    const orderRows = await db.select({ id: orders.id }).from(orders);
    deletedCounts.orders = orderRows.length;
    await db.delete(orders);

    // 11. Delete Product Reviews & Notifications
    const reviewRows = await db.select({ id: productReviews.id }).from(productReviews);
    deletedCounts.productReviews = reviewRows.length;
    await db.delete(productReviews);

    const notifRows = await db.select({ id: notifications.id }).from(notifications);
    deletedCounts.notifications = notifRows.length;
    await db.delete(notifications);

    // 12. Delete Non-Admin Customer Data & Sessions
    if (nonAdminIds.length > 0) {
      await db.delete(userAddresses).where(inArray(userAddresses.userId, nonAdminIds));
      await db.delete(sessions).where(inArray(sessions.userId, nonAdminIds));
      await db.delete(accountAppeals).where(inArray(accountAppeals.userId, nonAdminIds));
      await db.delete(users).where(inArray(users.id, nonAdminIds));
    }
    await db.delete(verificationTokens);

    // 13. Purge Uploaded Business Files (Private documents, photos, pvc, payments)
    const uploadRoot = path.resolve(
      process.cwd(),
      process.env.LOCAL_UPLOAD_DIR || "./uploads"
    );

    const purgeDirs = [
      path.join(uploadRoot, "private", "documents"),
      path.join(uploadRoot, "private", "payments"),
      path.join(uploadRoot, "private", "pvc"),
      path.join(uploadRoot, "private", "photos"),
    ];

    for (const dir of purgeDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const filePath = path.join(dir, f);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              deletedCounts.deletedFiles++;
            }
          }
        } catch (e) {
          console.error(`Error purging directory ${dir}:`, e);
        }
      }
    }

    // Purge non-admin profile pictures
    const profilesDir = path.join(uploadRoot, "public", "profiles");
    if (fs.existsSync(profilesDir)) {
      try {
        const files = fs.readdirSync(profilesDir);
        for (const f of files) {
          const filePath = path.join(profilesDir, f);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            deletedCounts.deletedFiles++;
          }
        }
      } catch (e) {}
    }

    // 14. Log authoritative audit event
    await logAuditEvent({
      userId: auth.user.id,
      action: "dev_database_wipe",
      entityType: "settings",
      details: {
        adminEmail: auth.user.email,
        deletedCounts,
        wipedAt: Date.now(),
        environment: process.env.NODE_ENV || "development",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Development data, orders, customers, and uploaded files wiped successfully.",
      deleted: deletedCounts,
    });
  } catch (error: any) {
    console.error("Execute dev cleanup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute development data cleanup" },
      { status: 500 }
    );
  }
}
