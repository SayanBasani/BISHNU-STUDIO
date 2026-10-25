import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getShopSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getShopSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Admin fetch settings error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve admin settings" },
      { status: 500 }
    );
  }
}
