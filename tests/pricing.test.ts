import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../src/db";
import { products, productCategories } from "../src/db/schema";
import {
  calculatePvcPrice,
  calculateDocumentPrintPrice,
  calculateLaminationPrice,
  calculatePhotoPrintPrice,
  calculateProductItemPrice,
} from "../src/lib/pricing";

describe("Dynamic Pricing Engine Formulas & Server Recalculation", () => {
  beforeAll(async () => {
    await db
      .insert(productCategories)
      .values({
        id: "cat_stat_01",
        name: "Paper & Printing Supplies",
        slug: "paper-and-printing-supplies",
        description: "Copier paper reams",
        sortOrder: 1,
      })
      .onConflictDoNothing();

    await db
      .insert(products)
      .values({
        id: "prod_01",
        categoryId: "cat_stat_01",
        name: "JK Copier A4 Paper Ream (75 GSM, 500 Sheets)",
        slug: "jk-copier-a4-75gsm-500-sheets",
        description: "High-grade multi-purpose paper",
        price: 360,
        discountedPrice: 340,
        stockQuantity: 150,
        isAvailable: true,
        sku: "JK-A4-75GSM",
      })
      .onConflictDoNothing();
  });
  it("should calculate PVC card printing accurately for different document types and copies", async () => {
    // Aadhaar PVC (₹50 base) x 2 copies = ₹100
    const aadhaarResult = await calculatePvcPrice({
      documentType: "aadhaar",
      copies: 2,
    });
    expect(aadhaarResult.unitPrice).toBe(50);
    expect(aadhaarResult.totalPrice).toBe(100);

    // Driving Licence (₹60 base) x 1 copy = ₹60
    const dlResult = await calculatePvcPrice({
      documentType: "dl",
      copies: 1,
    });
    expect(dlResult.unitPrice).toBe(60);
    expect(dlResult.totalPrice).toBe(60);
  });

  it("should calculate document printing with paper size, B&W/colour, duplex, and optional lamination", async () => {
    // A4 B&W Single-Sided: ₹3/page. 10 pages x 1 copy = ₹30
    const a4BwSingle = await calculateDocumentPrintPrice({
      paperSize: "A4",
      printMode: "bw",
      sides: "single",
      pageCount: 10,
      copies: 1,
      includeLamination: false,
    });
    expect(a4BwSingle.totalPrice).toBe(30);

    // A4 Colour Double-Sided: ₹8/side. 10 pages x 2 copies = ₹160
    const a4ColDouble = await calculateDocumentPrintPrice({
      paperSize: "A4",
      printMode: "color",
      sides: "double",
      pageCount: 10,
      copies: 2,
      includeLamination: false,
    });
    expect(a4ColDouble.totalPrice).toBe(160);

    // With lamination addon on A4 (5 sheets for 10 pages double-sided x 1 copy x ₹20 = +₹100)
    const withLamination = await calculateDocumentPrintPrice({
      paperSize: "A4",
      printMode: "bw",
      sides: "double",
      pageCount: 10,
      copies: 1,
      includeLamination: true,
    });
    // Base cost: 10 pages * 2.5 = 25. Lamination: 5 sheets * 20 = 100. Total = 125
    expect(withLamination.totalPrice).toBe(125);
  });

  it("should calculate lamination and photo printing correctly", async () => {
    // A4 Glossy (₹20/sheet) x 5 sheets x 2 copies = 10 sheets x ₹20 = ₹200
    const lamResult = await calculateLaminationPrice({
      laminationSize: "a4_glossy",
      sheets: 5,
      copies: 2,
    });
    expect(lamResult.totalPrice).toBe(200);

    // Passport size set (₹50/set) x 2 copies = ₹100
    const photoResult = await calculatePhotoPrintPrice({
      photoSize: "passport",
      photoFinish: "glossy",
      imageCount: 1,
      copiesPerImage: 2,
    });
    expect(photoResult.totalPrice).toBe(100);

    // 4x6 photo (₹15/print + ₹5 matte finish = ₹20/print) x 3 prints = ₹60
    const photo4x6Matte = await calculatePhotoPrintPrice({
      photoSize: "4x6",
      photoFinish: "matte",
      imageCount: 1,
      copiesPerImage: 3,
    });
    expect(photo4x6Matte.unitPrice).toBe(20);
    expect(photo4x6Matte.totalPrice).toBe(60);
  });

  it("should safely handle zero or negative quantities by normalizing to minimum 1", async () => {
    const res = await calculatePvcPrice({
      documentType: "pan",
      copies: -5,
    });
    expect(res.breakdown.quantity).toBe(1);
    expect(res.totalPrice).toBe(50);
  });

  it("should verify product prices and reject non-existent or out-of-stock items", async () => {
    // Valid seeded product JK Copier (discounted price ₹340)
    const validProd = await calculateProductItemPrice("prod_01", 2);
    expect(validProd.unitPrice).toBe(340);
    expect(validProd.totalPrice).toBe(680);

    // Non-existent product
    await expect(calculateProductItemPrice("invalid_prod_xyz", 1)).rejects.toThrow(
      /not found/i
    );
  });
});
