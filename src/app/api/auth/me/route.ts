import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { userAddresses } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const addresses = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, auth.user.id));

    return NextResponse.json({
      authenticated: true,
      user: {
        ...auth.user,
        addresses,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: "Failed to authenticate session" },
      { status: 500 }
    );
  }
}
