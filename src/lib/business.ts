/**
 * Authoritative Business Configuration Module
 * 
 * Provides centralized, typed access to business identity, store status, and branding.
 * 
 * Precedence Rule:
 * 1. Admin-managed persisted database settings (highest priority, dynamically editable)
 * 2. Deployment environment variables (BUSINESS_NAME, BUSINESS_LOGO_PATH, BUSINESS_URL, etc.)
 * 3. Safe, non-secret system fallbacks ("Bishnu Studio", "/logo.png")
 */

import { getShopSettings, ShopSettingsData } from "./settings";

export interface BusinessConfig {
  businessName: string;
  logoUrl: string | null;
  businessUrl: string;
  contactEmail: string;
  contactPhone: string;
  isOpen: boolean;
  closedMessage: string;
  openingHours: string;
  returnPolicyNotice: string;
  returnWindowDays: number;
  building: string;
  street: string;
  landmark: string | null;
  cityTown: string;
  state: string;
  pinCode: string;
}

export interface PublicBusinessConfig {
  businessName: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  isOpen: boolean;
  closedMessage: string;
  openingHours: string;
  returnPolicyNotice: string;
  returnWindowDays: number;
  building: string;
  street: string;
  landmark: string | null;
  cityTown: string;
  state: string;
  pinCode: string;
}

/**
 * Validates whether a logo path is a safe public asset reference.
 * Rejects Windows/local filesystem paths, javascript: URLs, and traversal patterns.
 */
export function validateLogoPath(pathStr: string | null | undefined): {
  valid: boolean;
  error?: string;
  safePath?: string | null;
} {
  if (!pathStr || pathStr.trim() === "") {
    return { valid: true, safePath: null };
  }

  const trimmed = pathStr.trim();

  // Reject Windows filesystem paths (e.g. C:\..., D:\..., \\server\...)
  if (/^[a-zA-Z]:[\\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {
    return {
      valid: false,
      error: "Local filesystem paths are not valid public assets. Please use a web path (e.g. /logo.png) or full HTTPS URL.",
    };
  }

  // Reject unsafe schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return {
      valid: false,
      error: "Unsafe URL scheme detected. Only relative web paths (/...) or HTTP/HTTPS URLs are permitted.",
    };
  }

  // Check path traversal
  if (trimmed.includes("..")) {
    return {
      valid: false,
      error: "Path traversal ('..') is not permitted in asset paths.",
    };
  }

  // Allow relative public assets (e.g., /logo.png, /uploads/...)
  if (trimmed.startsWith("/")) {
    return { valid: true, safePath: trimmed };
  }

  // Allow standard HTTP/HTTPS URLs
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { valid: true, safePath: trimmed };
    }
  } catch (e) {
    // Not a valid URL
  }

  return {
    valid: false,
    error: "Logo path must be a relative public path starting with '/' (e.g. /logo.png) or a valid HTTP/HTTPS URL.",
  };
}

/**
 * Resolves the authoritative business name following precedence:
 * DB setting > Environment variable > Fallback.
 */
export function resolveBusinessName(dbShopName?: string | null): string {
  if (dbShopName && dbShopName.trim() !== "") {
    return dbShopName.trim();
  }
  if (process.env.BUSINESS_NAME && process.env.BUSINESS_NAME.trim() !== "") {
    return process.env.BUSINESS_NAME.trim();
  }
  if (process.env.NEXT_PUBLIC_BUSINESS_NAME && process.env.NEXT_PUBLIC_BUSINESS_NAME.trim() !== "") {
    return process.env.NEXT_PUBLIC_BUSINESS_NAME.trim();
  }
  return "Bishnu Studio";
}

/**
 * Resolves the authoritative logo URL following precedence:
 * DB setting > Environment variable > Fallback (/logo.png).
 */
export function resolveLogoPath(dbLogoUrl?: string | null): string | null {
  if (dbLogoUrl && dbLogoUrl.trim() !== "") {
    const validation = validateLogoPath(dbLogoUrl);
    if (validation.valid && validation.safePath) {
      return validation.safePath;
    }
  }

  if (process.env.BUSINESS_LOGO_PATH && process.env.BUSINESS_LOGO_PATH.trim() !== "") {
    const validation = validateLogoPath(process.env.BUSINESS_LOGO_PATH);
    if (validation.valid && validation.safePath) {
      return validation.safePath;
    }
  }

  return "/logo.png";
}

/**
 * Retrieves the complete authoritative business configuration.
 */
export async function getAuthoritativeBusinessConfig(): Promise<BusinessConfig> {
  const shop = await getShopSettings();

  const businessName = resolveBusinessName(shop.shopName);
  const logoUrl = resolveLogoPath(shop.logoUrl);
  const businessUrl =
    process.env.BUSINESS_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  return {
    businessName,
    logoUrl,
    businessUrl,
    contactEmail: shop.contactEmail || "support@bishnustudio.com",
    contactPhone: shop.contactPhone || "9876543210",
    isOpen: (shop as any).isOpen !== undefined ? Boolean((shop as any).isOpen) : true,
    closedMessage:
      (shop as any).closedMessage ||
      "We are currently closed for new orders. Store browsing and existing order tracking remain active.",
    openingHours:
      shop.openingHours || "Mon-Sat 8:00 AM - 9:30 PM, Sun 10:00 AM - 4:00 PM",
    returnPolicyNotice:
      (shop as any).returnPolicyNotice ||
      "Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced.",
    returnWindowDays: (shop as any).returnWindowDays || 7,
    building: shop.building || "12/B Station Road",
    street: shop.street || "Main Market",
    landmark: shop.landmark || "Near Town Hall & Central Post Office",
    cityTown: shop.cityTown || "Barasat",
    state: shop.state || "West Bengal",
    pinCode: shop.pinCode || "700001",
  };
}
