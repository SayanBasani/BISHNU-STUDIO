import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  updateShopSettings,
  isValidUpiId,
  getActiveUpiAccount,
  switchActiveUpiAccount,
} from "@/lib/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

const paymentSettingsSchema = z.object({
  upiEnabled: z.boolean(),
  merchantName: z.string().min(2, "Merchant display name is required"),
  upiId: z.string().min(3, "UPI ID is required"),
  qrMode: z.enum(["uploaded_image", "generated_upi_id"]),
  uploadedQrImageUrl: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = paymentSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { upiEnabled, merchantName, upiId, qrMode, uploadedQrImageUrl, paymentInstructions } =
      validation.data;

    // Validate UPI ID format
    if (upiEnabled && !isValidUpiId(upiId)) {
      return NextResponse.json(
        {
          error:
            "Invalid UPI ID format. Must follow standard format like name@bank (e.g. bishnustudio@icici, 9876543210@paytm).",
        },
        { status: 400 }
      );
    }

    if (upiEnabled && qrMode === "uploaded_image" && !uploadedQrImageUrl) {
      return NextResponse.json(
        {
          error:
            "Please upload a valid QR code image or switch to 'Generate QR from UPI ID' mode.",
        },
        { status: 400 }
      );
    }

    const cleanUpiId = upiId.trim().toLowerCase();
    const currentActive = await getActiveUpiAccount();

    // If active receiving account UPI ID has changed, track history via switchActiveUpiAccount
    if (currentActive.upiId !== cleanUpiId) {
      await switchActiveUpiAccount({
        upiId: cleanUpiId,
        accountDisplayName: `${merchantName.trim()} Primary UPI`,
        merchantName: merchantName.trim(),
        qrMode,
        uploadedQrImageUrl: uploadedQrImageUrl?.trim() || null,
        paymentInstructions: paymentInstructions?.trim() || null,
        internalNotes: "Updated via Store Settings > UPI Payments",
        adminUserId: auth.user.id,
      });
    }

    const updated = await updateShopSettings(
      {
        upiEnabled,
        merchantName: merchantName.trim(),
        upiId: cleanUpiId,
        qrMode,
        uploadedQrImageUrl: uploadedQrImageUrl?.trim() || null,
        paymentInstructions: paymentInstructions?.trim() || null,
      },
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      message: "UPI payment settings updated successfully",
      settings: updated,
    });
  } catch (error: any) {
    console.error("Update payment settings error:", error);
    return NextResponse.json(
      { error: "Failed to update payment settings" },
      { status: 500 }
    );
  }
}

