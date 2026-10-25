import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { users, orders, accountAppeals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        avatarUrl: users.avatarUrl,
        status: users.status,
        blockedAt: users.blockedAt,
        blockedReason: users.blockedReason,
        blockedCategory: users.blockedCategory,
        blockedByAdminId: users.blockedByAdminId,
        isEmailVerified: users.isEmailVerified,
        isPhoneVerified: users.isPhoneVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const allOrders = await db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        totalAmount: orders.totalAmount,
      })
      .from(orders);

    const pendingAppeals = await db
      .select()
      .from(accountAppeals)
      .where(eq(accountAppeals.status, "submitted"));

    const customersWithStats = allUsers.map((u) => {
      const userOrders = allOrders.filter((o) => o.customerId === u.id);
      const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const pendingAppeal = pendingAppeals.find((a) => a.userId === u.id);
      return {
        ...u,
        orderCount: userOrders.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        hasPendingAppeal: !!pendingAppeal,
        pendingAppealId: pendingAppeal?.id || null,
      };
    });

    return NextResponse.json({
      success: true,
      customers: customersWithStats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve customer accounts" },
      { status: 500 }
    );
  }
}
