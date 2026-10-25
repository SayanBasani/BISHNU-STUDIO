import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { updateShopSettings } from "@/lib/settings";
import { validateLogoPath } from "@/lib/business";
import { z } from "zod";

export const dynamic = "force-dynamic";

const businessSettingsSchema = z.object({
  shopName: z.string().min(2, "Shop name is required"),
  building: z.string().min(1, "Building / House number is required"),
  street: z.string().min(1, "Street / Locality is required"),
  landmark: z.string().optional().nullable(),
  cityTown: z.string().min(1, "City / Town is required"),
  state: z.string().min(1, "State is required"),
  pinCode: z.string().regex(/^[0-9]{6}$/, "PIN code must be a 6-digit number"),
  contactPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  contactEmail: z.string().email("Please provide a valid email"),
  openingHours: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  isOpen: z.boolean().optional(),
  closedMessage: z.string().optional(),
  returnPolicyNotice: z.string().optional(),
  returnWindowDays: z.number().int().min(0).max(90).optional(),
  customerFulfillmentNote: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = businessSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    if (data.logoUrl) {
      const logoValidation = validateLogoPath(data.logoUrl);
      if (!logoValidation.valid) {
        return NextResponse.json(
          { error: logoValidation.error || "Invalid logo URL or asset path." },
          { status: 400 }
        );
      }
    }

    const updated = await updateShopSettings(
      {
        shopName: data.shopName.trim(),
        building: data.building.trim(),
        street: data.street.trim(),
        landmark: data.landmark?.trim() || null,
        cityTown: data.cityTown.trim(),
        state: data.state.trim(),
        pinCode: data.pinCode.trim(),
        contactPhone: data.contactPhone.trim(),
        contactEmail: data.contactEmail.trim().toLowerCase(),
        openingHours: data.openingHours?.trim() || null,
        logoUrl: data.logoUrl?.trim() || null,
        isOpen: data.isOpen !== undefined ? Boolean(data.isOpen) : undefined,
        closedMessage: data.closedMessage?.trim() || undefined,
        returnPolicyNotice: data.returnPolicyNotice?.trim() || undefined,
        returnWindowDays: data.returnWindowDays !== undefined ? data.returnWindowDays : undefined,
        customerFulfillmentNote: data.customerFulfillmentNote !== undefined ? (data.customerFulfillmentNote?.trim() || null) : undefined,
      },
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      message: "Business information updated successfully",
      settings: updated,
    });
  } catch (error: any) {
    console.error("Update business settings error:", error);
    return NextResponse.json(
      { error: "Failed to update business settings" },
      { status: 500 }
    );
  }
}
