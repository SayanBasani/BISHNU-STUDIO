import { db } from "../db";
import {
  users,
  userAddresses,
  sessions,
  orders,
  orderItems,
  orderFiles,
  orderReturns,
  orderReturnItems,
  payments,
  paymentSubmissions,
  orderStatusHistory,
  accountAppeals,
  productReviews,
  products,
  productImages,
  productCategories,
  shopSettings,
  services,
  serviceOptions,
  servicePrices,
} from "../db/schema";
import { eq, ne, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export async function resetTestDatabase(options: { force?: boolean } = {}) {
  console.log("=== BISHNU STUDIO TEST ENVIRONMENT RESET ===");

  // 1. Production Protection Guard
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.ENV === "production";

  if (isProduction && !options.force) {
    throw new Error(
      "SAFETY REFUSAL: Resetting data is strictly prohibited in production environments. Target verified as production."
    );
  }

  console.log("Environment verified as development/test. Proceeding with safe cleanup...");

  // 2. Identify and Preserve Administrator Account
  const existingAdmins = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"));

  let preservedAdmin = existingAdmins[0];

  if (!preservedAdmin) {
    console.log("No existing admin account found. Bootstrapping default administrator...");
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@Bishnu2026!";
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@bishnustudio.com").toLowerCase();
    
    await db.insert(users).values({
      id: "usr_admin_001",
      fullName: process.env.ADMIN_NAME || "Bishnu Studio Admin",
      email: adminEmail,
      phone: process.env.ADMIN_PHONE || "9876543210",
      passwordHash: adminHash,
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    const refreshedAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"));
    preservedAdmin = refreshedAdmins[0];
  }

  console.log(`Administrator preserved: ${preservedAdmin.email} (Role: ${preservedAdmin.role})`);

  // 3. Foreign-Key Compliant Deletion Order
  console.log("Cleaning dependent demo records...");
  
  // 3.1 Reviews & Appeals
  await db.delete(productReviews);
  await db.delete(accountAppeals);
  console.log("  - Product reviews & customer appeals cleared.");

  // 3.2 Payment submissions & Reconciliations
  await db.delete(paymentSubmissions);
  await db.delete(payments);
  console.log("  - Payment submissions & reconciliation records cleared.");

  // 3.3 Returns, Orders, Status Timeline & Files
  await db.delete(orderReturnItems);
  await db.delete(orderReturns);
  await db.delete(orderStatusHistory);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(orderFiles);
  console.log("  - Returns, orders, items, timeline history & order files cleared.");

  // 3.4 Product Catalog (products, images, categories)
  await db.delete(productImages);
  await db.delete(products);
  await db.delete(productCategories);
  console.log("  - Product images, catalog items & categories cleared.");

  // 3.5 Customer Addresses & Sessions
  await db.delete(userAddresses);
  // Remove sessions for non-admins
  await db.run(
    sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')`
  );
  console.log("  - Saved customer addresses & customer sessions cleared.");

  // 3.6 Customer Accounts (Strictly preserving role == 'admin')
  await db.delete(users).where(ne(users.role, "admin"));
  console.log("  - Demo customer accounts deleted. Admin account preserved.");

  // 4. Ensure Essential Configuration Records Exist
  // 4.1 Shop Settings
  const settingsRows = await db.select().from(shopSettings).where(eq(shopSettings.id, "default"));
  if (settingsRows.length === 0) {
    await db.insert(shopSettings).values({
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
      upiEnabled: true,
      merchantName: "Bishnu Studio",
      upiId: "bishnustudio@icici",
      qrMode: "generated_upi_id",
      paymentInstructions:
        "Pay the exact order amount using the QR code or UPI ID below. After completing your payment in your UPI application, upload your payment screenshot and enter your transaction reference. The shop will verify the payment before confirming your order.",
      updatedAt: Date.now(),
    });
    console.log("  - Default shop & UPI settings verified.");
  }

  // 5. Clean Uploaded Demo Files safely
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (fs.existsSync(uploadsDir)) {
    try {
      const subdirs = ["private", "public/profiles", "public/products"];
      for (const sub of subdirs) {
        const fullSub = path.join(uploadsDir, sub);
        if (fs.existsSync(fullSub)) {
          const files = fs.readdirSync(fullSub);
          for (const f of files) {
            const filePath = path.join(fullSub, f);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          }
        }
      }
      console.log("  - Demo upload files purged from ./uploads/ directories.");
    } catch (err: any) {
      console.warn("  - Warning cleaning files in uploads directory:", err?.message);
    }
  }

  console.log("=== RESET COMPLETE: CLEAN TEST ENVIRONMENT READY ===");
  console.log("Administrator can log in at /admin/login with email:", preservedAdmin.email);
}

// Direct execution guard
if (require.main === module) {
  resetTestDatabase()
    .then(() => {
      console.log("Database reset completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Reset failed:", err);
      process.exit(1);
    });
}
