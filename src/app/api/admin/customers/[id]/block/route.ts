import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, blockCustomer } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const blockSchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters"),
  category: z.enum(["spam", "abusive", "fraud", "misuse", "other"]).default("other"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot block your own administrative account." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const validation = blockSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { reason, category } = validation.data;

    await blockCustomer({
      userId: id,
      adminId: auth.user.id,
      reason,
      category,
    });

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    await logAuditEvent({
      userId: auth.user.id,
      action: "block_customer",
      entityType: "user",
      entityId: id,
      details: { reason, category },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: "Customer account successfully blocked and all active sessions terminated.",
    });
  } catch (error: any) {
    console.error("Block customer error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to block customer." },
      { status: 500 }
    );
  }
}
