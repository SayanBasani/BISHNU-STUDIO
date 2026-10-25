import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { accountAppeals, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appealsRows = await db
      .select({
        appeal: accountAppeals,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          status: users.status,
          blockedAt: users.blockedAt,
          blockedReason: users.blockedReason,
          blockedCategory: users.blockedCategory,
        },
      })
      .from(accountAppeals)
      .innerJoin(users, eq(accountAppeals.userId, users.id))
      .orderBy(desc(accountAppeals.createdAt));

    const appeals = appealsRows.map((row) => ({
      ...row.appeal,
      user: row.user,
    }));

    return NextResponse.json({
      success: true,
      appeals,
    });
  } catch (error: any) {
    console.error("Admin appeals list error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve account appeals." },
      { status: 500 }
    );
  }
}
