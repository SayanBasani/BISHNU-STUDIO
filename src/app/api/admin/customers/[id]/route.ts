import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { users, userAddresses, orders, authenticationEvents, accountAppeals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const userRows = await db
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
      .where(eq(users.id, id))
      .limit(1);

    if (userRows.length === 0) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    const customer = userRows[0];

    // Fetch customer's saved addresses
    const addresses = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, id))
      .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));

    // Fetch customer's orders
    const customerOrders = await db
      .select({
        id: orders.id,
        orderReference: orders.orderReference,
        orderType: orders.orderType,
        totalAmount: orders.totalAmount,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        deliveryType: orders.deliveryType,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt));

    // Fetch customer's authentication activity events
    const authEvents = await db
      .select()
      .from(authenticationEvents)
      .where(eq(authenticationEvents.userId, id))
      .orderBy(desc(authenticationEvents.createdAt))
      .limit(50);

    // Fetch customer's appeals
    const appeals = await db
      .select()
      .from(accountAppeals)
      .where(eq(accountAppeals.userId, id))
      .orderBy(desc(accountAppeals.createdAt));

    return NextResponse.json({
      success: true,
      customer,
      addresses,
      orders: customerOrders,
      authEvents,
      appeals,
    });
  } catch (error: any) {
    console.error("Customer detail fetch error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve customer details." },
      { status: 500 }
    );
  }
}
