import { db } from "@/db";
import { shopSettings, shopUpiAccounts, developerProfile } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import QRCode from "qrcode";
import { logAuditEvent } from "./audit";
import crypto from "crypto";
import { recordMutationIfInFallback } from "./db-sync";

export interface ShopSettingsData {
  id: string;
  shopName: string;
  building: string;
  street: string;
  landmark: string | null;
  cityTown: string;
  state: string;
  pinCode: string;
  contactPhone: string;
  contactEmail: string;
  openingHours: string | null;
  logoUrl: string | null;
  isOpen: boolean;
  closedMessage: string;
  returnPolicyNotice: string;
  returnWindowDays: number;
  customerFulfillmentNote: string | null;
  upiEnabled: boolean;
  merchantName: string;
  upiId: string;
  activeUpiAccountId?: string | null;
  qrMode: "uploaded_image" | "generated_upi_id";
  uploadedQrImageUrl: string | null;
  paymentInstructions: string | null;
  updatedAt: number;
}

export interface ShopUpiAccountData {
  id: string;
  upiId: string;
  accountDisplayName: string;
  merchantName: string;
  qrMode: "uploaded_image" | "generated_upi_id";
  uploadedQrImageUrl: string | null;
  paymentInstructions: string | null;
  isActive: boolean;
  deactivatedAt: number | null;
  internalNotes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface DeveloperProfileData {
  id: string;
  developerName: string;
  professionalTitle: string;
  biography: string;
  skills: string[];
  projectContribution: string;
  projectStartDate: string | null;
  projectCompletionDate: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  contactEmail: string | null;
  avatarUrl: string | null;
  creditsStatement: string;
  isPublished: boolean;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Omit<ShopSettingsData, "updatedAt"> = {
  id: "default",
  shopName: "Bishnu Studio",
  building: "12/B Station Road",
  street: "Main Market",
  landmark: "Near Town Hall & Central Post Office",
  cityTown: "Barasat",
  state: "West Bengal",
  pinCode: "700001",
  contactPhone: "9876543210",
  contactEmail: "support@bishnustudio.com",
  openingHours: "Mon-Sat 8:00 AM - 9:30 PM, Sun 10:00 AM - 4:00 PM",
  logoUrl: null,
  isOpen: true,
  closedMessage: "We are currently closed for new orders. Store browsing and existing order tracking remain active.",
  returnPolicyNotice: "Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced.",
  returnWindowDays: 7,
  customerFulfillmentNote: null,
  upiEnabled: true,
  merchantName: "Bishnu Studio",
  upiId: "9735154080@slc",
  activeUpiAccountId: null,
  qrMode: "generated_upi_id",
  uploadedQrImageUrl: null,
  paymentInstructions:
    "Pay the exact order amount using the QR code or UPI ID below. After completing your payment in your UPI application, upload your payment screenshot and enter your transaction reference. The shop will verify the payment before confirming your order.",
};

export const DEFAULT_DEVELOPER_PROFILE: Omit<DeveloperProfileData, "updatedAt"> = {
  id: "default",
  developerName: "Sayan (Antigravity Engineer)",
  professionalTitle: "Senior Full-Stack Engineer & Solutions Architect",
  biography:
    "Full-stack software engineer specializing in high-reliability e-commerce architectures, automated print pipelines, resilient payment workflows, and accessible responsive interfaces.",
  skills: [
    "Next.js 14 (App Router)",
    "TypeScript",
    "Tailwind CSS",
    "Drizzle ORM & LibSQL",
    "UPI Payment Workflows",
    "Serverless Architecture",
    "REST & Edge APIs",
    "PDF & Image Processing",
  ],
  projectContribution:
    "Architected and implemented Bishnu Studio end-to-end: secure document upload pipelines, server-side dynamic pricing calculation, manual UPI reconciliation engine, verified product reviews, customer management with appeal processing, and full dark/light theme consistency.",
  projectStartDate: "2024-01-15",
  projectCompletionDate: "2024-10-25",
  portfolioUrl: "https://github.com",
  githubUrl: "https://github.com",
  linkedinUrl: "https://linkedin.com",
  contactEmail: "developer@bishnustudio.com",
  avatarUrl: null,
  creditsStatement:
    "Website developed and maintained by Sayan (Antigravity Engineer) for Bishnu Studio. All rights reserved.",
  isPublished: true,
};

let cachedShopSettings: { data: ShopSettingsData; expiresAt: number } | null = null;

export function invalidateShopSettingsCache() {
  cachedShopSettings = null;
}

export async function getShopSettings(): Promise<ShopSettingsData> {
  const now = Date.now();
  if (cachedShopSettings && cachedShopSettings.expiresAt > now) {
    return cachedShopSettings.data;
  }

  try {
    const rows = await db
      .select()
      .from(shopSettings)
      .where(eq(shopSettings.id, "default"))
      .limit(1);

    if (rows.length > 0) {
      const raw = rows[0] as any;
      const data: ShopSettingsData = {
        ...DEFAULT_SETTINGS,
        ...raw,
        isOpen: raw.isOpen !== undefined && raw.isOpen !== null ? Boolean(raw.isOpen) : true,
        closedMessage: raw.closedMessage || DEFAULT_SETTINGS.closedMessage,
        returnPolicyNotice: raw.returnPolicyNotice || DEFAULT_SETTINGS.returnPolicyNotice,
        returnWindowDays: raw.returnWindowDays || DEFAULT_SETTINGS.returnWindowDays,
        updatedAt: Number(raw.updatedAt || now),
      };
      cachedShopSettings = { data, expiresAt: now + 60_000 };
      return data;
    }

    // Insert default settings if not exists
    await db
      .insert(shopSettings)
      .values({
        ...DEFAULT_SETTINGS,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const inserted = await db
      .select()
      .from(shopSettings)
      .where(eq(shopSettings.id, "default"))
      .limit(1);

    const data = (inserted[0] || { ...DEFAULT_SETTINGS, updatedAt: now }) as ShopSettingsData;
    cachedShopSettings = { data, expiresAt: now + 60_000 };
    return data;
  } catch (error) {
    console.error("Error retrieving shop settings:", error);
    return { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
  }
}

export async function updateShopSettings(
  updates: Partial<Omit<ShopSettingsData, "id" | "updatedAt">>,
  adminUserId?: string
): Promise<ShopSettingsData> {
  invalidateShopSettingsCache();
  const current = await getShopSettings();
  const now = Date.now();

  await db
    .update(shopSettings)
    .set({
      ...updates,
      updatedAt: now,
      updatedByUserId: adminUserId || null,
    })
    .where(eq(shopSettings.id, "default"));

  await recordMutationIfInFallback(db, {
    entityType: "shop_settings",
    entityId: "default",
    operation: "UPDATE",
    payload: {
      id: "default",
      ...updates,
      updatedAt: now,
    },
  });

  if (adminUserId) {
    await logAuditEvent({
      userId: adminUserId,
      action: "update_shop_settings",
      entityType: "settings",
      entityId: "default",
      details: updates,
    });
  }

  invalidateShopSettingsCache();
  return await getShopSettings();
}

/**
 * Retrieves the currently active receiving UPI account.
 * Auto-initializes from shopSettings if no accounts exist yet.
 */
export async function getActiveUpiAccount(): Promise<ShopUpiAccountData> {
  try {
    const activeRows = await db
      .select()
      .from(shopUpiAccounts)
      .where(eq(shopUpiAccounts.isActive, true))
      .orderBy(desc(shopUpiAccounts.createdAt))
      .limit(1);

    if (activeRows.length > 0) {
      return {
        ...activeRows[0],
        isActive: Boolean(activeRows[0].isActive),
      } as ShopUpiAccountData;
    }

    // If no active account exists in shopUpiAccounts, bootstrap from current shopSettings
    const settings = await getShopSettings();
    const now = Date.now();
    const defaultAccountId = "acc_upi_default";

    const initialAccount: typeof shopUpiAccounts.$inferInsert = {
      id: defaultAccountId,
      upiId: settings.upiId || "9735154080@slc",
      accountDisplayName: `${settings.merchantName || "Bishnu Studio"} Primary UPI`,
      merchantName: settings.merchantName || "Bishnu Studio",
      qrMode: settings.qrMode || "generated_upi_id",
      uploadedQrImageUrl: settings.uploadedQrImageUrl || null,
      paymentInstructions: settings.paymentInstructions || null,
      isActive: true,
      internalNotes: "Bootstrap initial receiving UPI account",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(shopUpiAccounts).values(initialAccount).onConflictDoNothing();

    await db
      .update(shopSettings)
      .set({ activeUpiAccountId: defaultAccountId, updatedAt: now })
      .where(eq(shopSettings.id, "default"));

    const created = await db
      .select()
      .from(shopUpiAccounts)
      .where(eq(shopUpiAccounts.id, defaultAccountId))
      .limit(1);

    const row = created[0] || initialAccount;
    return {
      ...row,
      isActive: Boolean(row.isActive),
    } as ShopUpiAccountData;
  } catch (error) {
    console.error("Error retrieving active UPI account:", error);
    return {
      id: "acc_upi_default",
      upiId: "9735154080@slc",
      accountDisplayName: "Bishnu Studio Primary UPI",
      merchantName: "Bishnu Studio",
      qrMode: "generated_upi_id",
      uploadedQrImageUrl: null,
      paymentInstructions: null,
      isActive: true,
      deactivatedAt: null,
      internalNotes: "Emergency fallback",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

/**
 * Retrieves all receiving UPI accounts (both active and historical).
 */
export async function getAllUpiAccounts(): Promise<ShopUpiAccountData[]> {
  // Ensure at least the initial account is seeded
  await getActiveUpiAccount();

  const rows = await db
    .select()
    .from(shopUpiAccounts)
    .orderBy(desc(shopUpiAccounts.createdAt));

  return rows.map((r) => ({
    ...r,
    isActive: Boolean(r.isActive),
  })) as ShopUpiAccountData[];
}

/**
 * Atomically switches the active receiving UPI account.
 * Deactivates existing active account(s) without altering any historical payments.
 * Commits new account and updates live shop settings.
 */
export async function switchActiveUpiAccount({
  upiId,
  accountDisplayName,
  merchantName,
  qrMode,
  uploadedQrImageUrl,
  paymentInstructions,
  internalNotes,
  adminUserId,
}: {
  upiId: string;
  accountDisplayName: string;
  merchantName?: string;
  qrMode?: "uploaded_image" | "generated_upi_id";
  uploadedQrImageUrl?: string | null;
  paymentInstructions?: string | null;
  internalNotes?: string | null;
  adminUserId?: string;
}): Promise<ShopUpiAccountData> {
  const cleanUpiId = upiId.trim().toLowerCase();
  if (!isValidUpiId(cleanUpiId)) {
    throw new Error("Invalid UPI ID format. Must follow standard format like name@bank.");
  }

  const now = Date.now();
  const currentActive = await getActiveUpiAccount();

  // Deactivate all currently active accounts
  await db
    .update(shopUpiAccounts)
    .set({
      isActive: false,
      deactivatedAt: now,
      updatedAt: now,
    })
    .where(eq(shopUpiAccounts.isActive, true));

  // Insert new active account
  const newAccountId = `acc_upi_${crypto.randomUUID()}`;
  const effectiveMerchantName = merchantName?.trim() || currentActive.merchantName || "Bishnu Studio";
  const effectiveQrMode = qrMode || currentActive.qrMode || "generated_upi_id";

  const newAccount: typeof shopUpiAccounts.$inferInsert = {
    id: newAccountId,
    upiId: cleanUpiId,
    accountDisplayName: accountDisplayName.trim(),
    merchantName: effectiveMerchantName,
    qrMode: effectiveQrMode,
    uploadedQrImageUrl: uploadedQrImageUrl?.trim() || null,
    paymentInstructions: paymentInstructions?.trim() || null,
    isActive: true,
    deactivatedAt: null,
    internalNotes: internalNotes?.trim() || null,
    createdByUserId: adminUserId || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(shopUpiAccounts).values(newAccount);

  // Update shop settings with the new active account
  await db
    .update(shopSettings)
    .set({
      activeUpiAccountId: newAccountId,
      upiId: cleanUpiId,
      merchantName: effectiveMerchantName,
      qrMode: effectiveQrMode,
      uploadedQrImageUrl: uploadedQrImageUrl?.trim() || null,
      paymentInstructions: paymentInstructions?.trim() || null,
      updatedAt: now,
      updatedByUserId: adminUserId || null,
    })
    .where(eq(shopSettings.id, "default"));

  // Audit log
  if (adminUserId) {
    await logAuditEvent({
      userId: adminUserId,
      action: "switched_active_upi_account",
      entityType: "payment",
      entityId: newAccountId,
      details: {
        previousAccountId: currentActive.id,
        previousUpiId: currentActive.upiId,
        newAccountId,
        newUpiId: cleanUpiId,
        displayName: accountDisplayName.trim(),
      },
    });
  }

  const inserted = await db
    .select()
    .from(shopUpiAccounts)
    .where(eq(shopUpiAccounts.id, newAccountId))
    .limit(1);

  const insertedRow = inserted[0] || newAccount;
  return {
    ...insertedRow,
    isActive: Boolean(insertedRow.isActive),
  } as ShopUpiAccountData;
}

/**
 * Retrieves the developer / credits profile.
 * Auto-initializes if not present.
 */
export async function getDeveloperProfile(): Promise<DeveloperProfileData> {
  try {
    const rows = await db
      .select()
      .from(developerProfile)
      .where(eq(developerProfile.id, "default"))
      .limit(1);

    if (rows.length > 0) {
      const row = rows[0];
      let parsedSkills: string[] = [];
      try {
        parsedSkills = row.skillsJson ? JSON.parse(row.skillsJson) : [];
      } catch {
        parsedSkills = DEFAULT_DEVELOPER_PROFILE.skills;
      }

      return {
        id: row.id,
        developerName: row.developerName,
        professionalTitle: row.professionalTitle,
        biography: row.biography,
        skills: parsedSkills,
        projectContribution: row.projectContribution || "",
        projectStartDate: row.projectStartDate,
        projectCompletionDate: row.projectCompletionDate,
        portfolioUrl: row.portfolioUrl,
        githubUrl: row.githubUrl,
        linkedinUrl: row.linkedinUrl,
        contactEmail: row.contactEmail,
        avatarUrl: row.avatarUrl,
        creditsStatement: row.creditsStatement || DEFAULT_DEVELOPER_PROFILE.creditsStatement,
        isPublished: Boolean(row.isPublished),
        updatedAt: row.updatedAt,
      };
    }

    // Insert default profile if not exists
    const now = Date.now();
    await db
      .insert(developerProfile)
      .values({
        id: "default",
        developerName: DEFAULT_DEVELOPER_PROFILE.developerName,
        professionalTitle: DEFAULT_DEVELOPER_PROFILE.professionalTitle,
        biography: DEFAULT_DEVELOPER_PROFILE.biography,
        skillsJson: JSON.stringify(DEFAULT_DEVELOPER_PROFILE.skills),
        projectContribution: DEFAULT_DEVELOPER_PROFILE.projectContribution,
        projectStartDate: DEFAULT_DEVELOPER_PROFILE.projectStartDate,
        projectCompletionDate: DEFAULT_DEVELOPER_PROFILE.projectCompletionDate,
        portfolioUrl: DEFAULT_DEVELOPER_PROFILE.portfolioUrl,
        githubUrl: DEFAULT_DEVELOPER_PROFILE.githubUrl,
        linkedinUrl: DEFAULT_DEVELOPER_PROFILE.linkedinUrl,
        contactEmail: DEFAULT_DEVELOPER_PROFILE.contactEmail,
        avatarUrl: DEFAULT_DEVELOPER_PROFILE.avatarUrl,
        creditsStatement: DEFAULT_DEVELOPER_PROFILE.creditsStatement,
        isPublished: DEFAULT_DEVELOPER_PROFILE.isPublished,
        updatedAt: now,
      })
      .onConflictDoNothing();

    return {
      ...DEFAULT_DEVELOPER_PROFILE,
      updatedAt: now,
    };
  } catch (error) {
    console.error("Error retrieving developer profile:", error);
    return {
      ...DEFAULT_DEVELOPER_PROFILE,
      updatedAt: Date.now(),
    };
  }
}

/**
 * Updates the developer / credits profile with administrative validation.
 */
export async function updateDeveloperProfile(
  updates: Partial<{
    developerName: string;
    professionalTitle: string;
    biography: string;
    skills: string[];
    projectContribution: string;
    projectStartDate: string | null;
    projectCompletionDate: string | null;
    portfolioUrl: string | null;
    githubUrl: string | null;
    linkedinUrl: string | null;
    contactEmail: string | null;
    avatarUrl: string | null;
    creditsStatement: string;
    isPublished: boolean;
  }>,
  adminUserId?: string
): Promise<DeveloperProfileData> {
  const current = await getDeveloperProfile();
  const now = Date.now();

  const dbUpdates: Partial<typeof developerProfile.$inferInsert> = {
    updatedAt: now,
    updatedByUserId: adminUserId || null,
  };

  if (updates.developerName !== undefined) dbUpdates.developerName = updates.developerName.trim();
  if (updates.professionalTitle !== undefined)
    dbUpdates.professionalTitle = updates.professionalTitle.trim();
  if (updates.biography !== undefined) dbUpdates.biography = updates.biography.trim();
  if (updates.skills !== undefined) dbUpdates.skillsJson = JSON.stringify(updates.skills);
  if (updates.projectContribution !== undefined)
    dbUpdates.projectContribution = updates.projectContribution.trim();
  if (updates.projectStartDate !== undefined) dbUpdates.projectStartDate = updates.projectStartDate;
  if (updates.projectCompletionDate !== undefined)
    dbUpdates.projectCompletionDate = updates.projectCompletionDate;
  if (updates.portfolioUrl !== undefined)
    dbUpdates.portfolioUrl = updates.portfolioUrl?.trim() || null;
  if (updates.githubUrl !== undefined) dbUpdates.githubUrl = updates.githubUrl?.trim() || null;
  if (updates.linkedinUrl !== undefined)
    dbUpdates.linkedinUrl = updates.linkedinUrl?.trim() || null;
  if (updates.contactEmail !== undefined)
    dbUpdates.contactEmail = updates.contactEmail?.trim() || null;
  if (updates.avatarUrl !== undefined) dbUpdates.avatarUrl = updates.avatarUrl?.trim() || null;
  if (updates.creditsStatement !== undefined)
    dbUpdates.creditsStatement = updates.creditsStatement.trim();
  if (updates.isPublished !== undefined) dbUpdates.isPublished = updates.isPublished;

  await db
    .update(developerProfile)
    .set(dbUpdates)
    .where(eq(developerProfile.id, "default"));

  if (adminUserId) {
    await logAuditEvent({
      userId: adminUserId,
      action: "update_developer_profile",
      entityType: "settings",
      entityId: "default",
      details: updates,
    });
  }

  return await getDeveloperProfile();
}

/**
 * Builds standard NPCI-compliant UPI payment URI
 */
export function buildUpiPaymentUri({
  upiId,
  merchantName,
  amount,
  orderReference,
  transactionNote,
}: {
  upiId: string;
  merchantName: string;
  amount: number;
  orderReference: string;
  transactionNote?: string;
}): string {
  const cleanUpiId = upiId.trim();
  const cleanName = merchantName.trim();
  const cleanAmount = (Math.round(amount * 100) / 100).toFixed(2);
  const cleanRef = orderReference.trim();
  const note = transactionNote ? transactionNote.trim() : `Order ${cleanRef}`;

  const params = new URLSearchParams({
    pa: cleanUpiId,
    pn: cleanName,
    am: cleanAmount,
    cu: "INR",
    tn: note,
    tr: cleanRef,
  });

  const encoded = params.toString().replace(/\+/g, "%20");
  return `upi://pay?${encoded}`;
}

export function getUpiAppLinks(upiUri: string) {
  const queryPart = upiUri.startsWith("upi://pay?") ? upiUri.substring("upi://pay?".length) : "";
  return {
    universal: upiUri,
    gpay: `tez://upi/pay?${queryPart}`,
    phonepe: `phonepe://pay?${queryPart}`,
    paytm: `paytmmp://pay?${queryPart}`,
  };
}

export async function generateQrCodeDataUrl(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: options?.width || 360,
    margin: options?.margin !== undefined ? options.margin : 2,
    color: {
      dark: "#0f172a", // Slate 900
      light: "#ffffff", // Pure white for perfect scanning
    },
    errorCorrectionLevel: "M",
    ...options,
  });
}

export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== "string") return false;
  const clean = upiId.trim();
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(clean);
}

export function normalizeTransactionId(trId: string): string {
  if (!trId || typeof trId !== "string") return "";
  return trId.trim().replace(/\s+/g, "").toUpperCase();
}

export function isValidTransactionId(trId: string): boolean {
  if (!trId || typeof trId !== "string") return false;
  const clean = normalizeTransactionId(trId);
  const trRegex = /^[A-Z0-9\-_]{8,30}$/;
  return trRegex.test(clean);
}
