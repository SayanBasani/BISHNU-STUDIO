import { NextRequest, NextResponse } from "next/server";
import { getShopSettings } from "@/lib/settings";
import { resolveBusinessName, resolveLogoPath } from "@/lib/business";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const settings = await getShopSettings();
    const effectiveShopName = resolveBusinessName(settings.shopName);
    const effectiveLogoUrl = resolveLogoPath(settings.logoUrl);

    const publicSettings = {
      shopName: effectiveShopName,
      businessName: effectiveShopName,
      building: settings.building,
      street: settings.street,
      landmark: settings.landmark,
      cityTown: settings.cityTown,
      state: settings.state,
      pinCode: settings.pinCode,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      openingHours: settings.openingHours,
      logoUrl: effectiveLogoUrl,
      isOpen: settings.isOpen !== undefined ? Boolean(settings.isOpen) : true,
      closedMessage: settings.closedMessage,
      returnPolicyNotice: settings.returnPolicyNotice,
      returnWindowDays: settings.returnWindowDays || 7,
      customerFulfillmentNote: settings.customerFulfillmentNote,
      // UPI Public settings
      upiEnabled: settings.upiEnabled,
      merchantName: settings.merchantName || effectiveShopName,
      upiId: settings.upiId,
      qrMode: settings.qrMode,
      uploadedQrImageUrl: settings.uploadedQrImageUrl,
      paymentInstructions: settings.paymentInstructions,
    };

    return NextResponse.json(
      {
        success: true,
        settings: publicSettings,
        shop: publicSettings, // backward compatibility
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Fetch shop settings error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve shop settings" },
      { status: 500 }
    );
  }
}
