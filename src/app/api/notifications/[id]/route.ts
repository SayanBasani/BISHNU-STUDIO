import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { deleteNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const recipientType: "admin" | "customer" =
      auth.user.role === "admin" ? "admin" : "customer";

    const result = await deleteNotification(id, {
      recipientType,
      recipientId: auth.user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete notification" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, notificationId: id });
  } catch (error: any) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
