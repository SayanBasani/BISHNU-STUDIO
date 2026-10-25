import { db } from "@/db";
import { services, serviceOptions, servicePrices, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface PvcCalculationInput {
  documentType: string; // 'aadhaar', 'pan', 'dl', 'voter', 'ration', 'other'
  copies: number;
}

export interface DocumentPrintCalculationInput {
  paperSize: "A4" | "Legal" | "A3" | string;
  printMode: "bw" | "color";
  sides: "single" | "double";
  pageCount: number;
  copies: number;
  includeLamination?: boolean;
}

export interface LaminationCalculationInput {
  laminationSize: "a4_glossy" | "a4_matte" | "id_card" | "legal_glossy" | "a3_glossy" | string;
  sheets: number;
  copies: number;
}

export interface PhotoPrintCalculationInput {
  photoSize: "passport" | "stamp_size" | "4x6" | "5x7" | "a4_photo" | string;
  photoFinish?: "glossy" | "matte";
  imageCount: number;
  copiesPerImage: number;
}

export interface CalculatedPriceResult {
  unitPrice: number;
  totalPrice: number;
  breakdown: {
    description: string;
    rate: number;
    unit: string;
    quantity: number;
    multiplier?: number;
    extraCharges?: number;
  };
}

/**
 * Calculates PVC Card Printing Price using real-time database pricing rules.
 */
export async function calculatePvcPrice(
  input: PvcCalculationInput
): Promise<CalculatedPriceResult> {
  const copies = Math.max(1, Math.floor(input.copies || 1));
  const docKey = input.documentType.toLowerCase();

  // Fetch configured price from DB
  const priceRecord = await db
    .select({
      price: servicePrices.price,
      unit: servicePrices.unit,
      optionName: serviceOptions.optionName,
    })
    .from(servicePrices)
    .innerJoin(serviceOptions, eq(servicePrices.optionId, serviceOptions.id))
    .where(
      and(
        eq(servicePrices.serviceId, "srv_pvc"),
        eq(serviceOptions.optionKey, docKey)
      )
    )
    .limit(1);

  // Fallback if specific doc type not found
  const baseRate = priceRecord.length > 0 ? priceRecord[0].price : 50.0;
  const docName = priceRecord.length > 0 ? priceRecord[0].optionName : "PVC Card";

  const total = baseRate * copies;

  return {
    unitPrice: baseRate,
    totalPrice: Math.round(total * 100) / 100,
    breakdown: {
      description: `${docName} PVC Printing`,
      rate: baseRate,
      unit: "per card",
      quantity: copies,
    },
  };
}

/**
 * Calculates Document Printing Price safely on the server.
 */
export async function calculateDocumentPrintPrice(
  input: DocumentPrintCalculationInput
): Promise<CalculatedPriceResult> {
  const pages = Math.max(1, Math.floor(input.pageCount || 1));
  const copies = Math.max(1, Math.floor(input.copies || 1));
  const size = input.paperSize.toLowerCase(); // 'a4', 'legal', 'a3'
  const mode = input.printMode === "color" ? "col" : "bw";
  const sides = input.sides === "double" ? "double" : "single";

  // Construct lookup key: e.g. 'a4_bw_single', 'legal_col_double', 'a3_bw_single'
  const rateKey = `${size}_${mode}_${sides}`;

  const priceRecord = await db
    .select({
      price: servicePrices.price,
      unit: servicePrices.unit,
      optionName: serviceOptions.optionName,
    })
    .from(servicePrices)
    .innerJoin(serviceOptions, eq(servicePrices.optionId, serviceOptions.id))
    .where(
      and(
        eq(servicePrices.serviceId, "srv_doc"),
        eq(serviceOptions.optionKey, rateKey)
      )
    )
    .limit(1);

  // Fallback defaults if exact combination isn't defined
  let ratePerPage = 3.0;
  if (priceRecord.length > 0) {
    ratePerPage = priceRecord[0].price;
  } else {
    // Sensible fallbacks
    if (size === "a3") {
      ratePerPage = mode === "col" ? 25.0 : 10.0;
    } else if (size === "legal") {
      ratePerPage = mode === "col" ? (sides === "double" ? 10.0 : 12.0) : (sides === "double" ? 3.5 : 4.0);
    } else {
      // A4 default
      ratePerPage = mode === "col" ? (sides === "double" ? 8.0 : 10.0) : (sides === "double" ? 2.5 : 3.0);
    }
  }

  // Base printing cost = Number of pages * copies * ratePerPage
  const baseCost = pages * copies * ratePerPage;

  // Lamination add-on if requested
  let laminationCost = 0;
  if (input.includeLamination) {
    // Sheet count for lamination: if double-sided, sheets = ceil(pages / 2), else pages
    const sheetCount = sides === "double" ? Math.ceil(pages / 2) : pages;
    
    // Look up authoritative lamination rate from database
    const lamKey = size === "a3" ? "a3_glossy" : "a4_glossy";
    const lamRecord = await db
      .select({ price: servicePrices.price })
      .from(servicePrices)
      .innerJoin(serviceOptions, eq(servicePrices.optionId, serviceOptions.id))
      .where(
        and(
          eq(servicePrices.serviceId, "srv_lam"),
          eq(serviceOptions.optionKey, lamKey)
        )
      )
      .limit(1);

    const laminationRate = lamRecord.length > 0 ? lamRecord[0].price : (size === "a3" ? 50 : 20);
    laminationCost = sheetCount * copies * laminationRate;
  }

  const totalPrice = baseCost + laminationCost;
  const unitPrice = totalPrice / copies;

  return {
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
    breakdown: {
      description: `${input.paperSize.toUpperCase()} ${input.printMode.toUpperCase()} (${input.sides === "double" ? "Double-Sided" : "Single-Sided"})`,
      rate: ratePerPage,
      unit: "per page",
      quantity: pages * copies,
      extraCharges: laminationCost,
    },
  };
}

/**
 * Calculates Lamination Price.
 */
export async function calculateLaminationPrice(
  input: LaminationCalculationInput
): Promise<CalculatedPriceResult> {
  const sheets = Math.max(1, Math.floor(input.sheets || 1));
  const copies = Math.max(1, Math.floor(input.copies || 1));
  const lamKey = input.laminationSize.toLowerCase();

  const priceRecord = await db
    .select({
      price: servicePrices.price,
      unit: servicePrices.unit,
      optionName: serviceOptions.optionName,
    })
    .from(servicePrices)
    .innerJoin(serviceOptions, eq(servicePrices.optionId, serviceOptions.id))
    .where(
      and(
        eq(servicePrices.serviceId, "srv_lam"),
        eq(serviceOptions.optionKey, lamKey)
      )
    )
    .limit(1);

  const ratePerSheet = priceRecord.length > 0 ? priceRecord[0].price : 20.0;
  const optName = priceRecord.length > 0 ? priceRecord[0].optionName : "A4 Lamination";

  const totalSheets = sheets * copies;
  const totalPrice = totalSheets * ratePerSheet;

  return {
    unitPrice: ratePerSheet,
    totalPrice: Math.round(totalPrice * 100) / 100,
    breakdown: {
      description: optName,
      rate: ratePerSheet,
      unit: "per sheet",
      quantity: totalSheets,
    },
  };
}

/**
 * Calculates Photo Printing Price.
 */
export async function calculatePhotoPrintPrice(
  input: PhotoPrintCalculationInput
): Promise<CalculatedPriceResult> {
  const imageCount = Math.max(1, Math.floor(input.imageCount || 1));
  const copiesPerImage = Math.max(1, Math.floor(input.copiesPerImage || 1));
  const sizeKey = input.photoSize.toLowerCase();

  const priceRecord = await db
    .select({
      price: servicePrices.price,
      unit: servicePrices.unit,
      optionName: serviceOptions.optionName,
    })
    .from(servicePrices)
    .innerJoin(serviceOptions, eq(servicePrices.optionId, serviceOptions.id))
    .where(
      and(
        eq(servicePrices.serviceId, "srv_photo"),
        eq(serviceOptions.optionKey, sizeKey)
      )
    )
    .limit(1);

  let ratePerPrint = priceRecord.length > 0 ? priceRecord[0].price : 15.0;
  const optName = priceRecord.length > 0 ? priceRecord[0].optionName : "4x6 Photo";

  // Optional finish charge (e.g., Matte Silk finish +₹5)
  if (input.photoFinish === "matte" && sizeKey !== "passport") {
    ratePerPrint += 5.0;
  }

  const totalPrints = imageCount * copiesPerImage;
  const totalPrice = totalPrints * ratePerPrint;

  return {
    unitPrice: ratePerPrint,
    totalPrice: Math.round(totalPrice * 100) / 100,
    breakdown: {
      description: `${optName} (${input.photoFinish === "matte" ? "Matte Finish" : "Glossy"})`,
      rate: ratePerPrint,
      unit: "per print",
      quantity: totalPrints,
    },
  };
}

/**
 * Verifies and calculates the price of a catalog product from the database.
 * Never trusts prices submitted by client-side browser forms.
 */
export async function calculateProductItemPrice(
  productId: string,
  quantity: number
): Promise<{ unitPrice: number; totalPrice: number; product: any }> {
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (productRows.length === 0) {
    throw new Error(`Product with ID "${productId}" not found.`);
  }

  const prod = productRows[0];
  if (!prod.isAvailable) {
    throw new Error(`Product "${prod.name}" is currently unavailable.`);
  }

  const validQty = Math.max(1, Math.floor(quantity || 1));
  if (prod.stockQuantity < validQty) {
    throw new Error(
      `Insufficient stock for "${prod.name}". Available: ${prod.stockQuantity}, Requested: ${validQty}.`
    );
  }

  const effectiveUnitPrice =
    prod.discountedPrice && prod.discountedPrice > 0
      ? prod.discountedPrice
      : prod.price;

  const totalPrice = effectiveUnitPrice * validQty;

  return {
    unitPrice: effectiveUnitPrice,
    totalPrice: Math.round(totalPrice * 100) / 100,
    product: prod,
  };
}
