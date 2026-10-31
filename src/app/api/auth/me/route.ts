import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { userAddresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createRequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const timer = createRequestTimer(req);
  try {
    const auth = await timer.measure("authentication", async () => {
      return await getAuthSession();
    });

    if (!auth?.user) {
      return timer.finish(
        NextResponse.json({ authenticated: false, user: null }, { status: 200 })
      );
    }

    // Only query addresses if explicitly requested (e.g. checkout or profile address management),
    // eliminating redundant database roundtrip during regular session hydration
    const includeAddresses = req.nextUrl.searchParams.get("includeAddresses") === "true";
    let addresses: any[] = [];
    if (includeAddresses) {
      addresses = await timer.measure("database.user_addresses", async () => {
        return await db
          .select()
          .from(userAddresses)
          .where(eq(userAddresses.userId, auth.user.id));
      });
    }

    return timer.finish(
      NextResponse.json({
        authenticated: true,
        user: {
          ...auth.user,
          addresses,
        },
      })
    );
  } catch (error) {
    return timer.finish(
      NextResponse.json(
        { authenticated: false, error: "Failed to authenticate session" },
        { status: 500 }
      )
    );
  }
}
