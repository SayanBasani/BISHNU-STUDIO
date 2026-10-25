import { NextRequest, NextResponse } from "next/server";
import {
  calculatePvcPrice,
  calculateDocumentPrintPrice,
  calculateLaminationPrice,
  calculatePhotoPrintPrice,
  calculateProductItemPrice,
} from "@/lib/pricing";
import { z } from "zod";

const calculateSchema = z.object({
  serviceType: z.enum([
    "pvc_card",
    "document_print",
    "lamination",
    "photo_print",
    "product",
  ]),
  payload: z.record(z.any()),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = calculateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { serviceType, payload } = validation.data;

    let result;
    if (serviceType === "pvc_card") {
      result = await calculatePvcPrice({
        documentType: payload.documentType || "aadhaar",
        copies: Number(payload.copies) || 1,
      });
    } else if (serviceType === "document_print") {
      result = await calculateDocumentPrintPrice({
        paperSize: payload.paperSize || "A4",
        printMode: payload.printMode || "bw",
        sides: payload.sides || "single",
        pageCount: Number(payload.pageCount) || 1,
        copies: Number(payload.copies) || 1,
        includeLamination: Boolean(payload.includeLamination),
      });
    } else if (serviceType === "lamination") {
      result = await calculateLaminationPrice({
        laminationSize: payload.laminationSize || "a4_glossy",
        sheets: Number(payload.sheets) || 1,
        copies: Number(payload.copies) || 1,
      });
    } else if (serviceType === "photo_print") {
      result = await calculatePhotoPrintPrice({
        photoSize: payload.photoSize || "4x6",
        photoFinish: payload.photoFinish || "glossy",
        imageCount: Number(payload.imageCount) || 1,
        copiesPerImage: Number(payload.copiesPerImage) || 1,
      });
    } else if (serviceType === "product") {
      const prodResult = await calculateProductItemPrice(
        payload.productId,
        Number(payload.quantity) || 1
      );
      result = {
        unitPrice: prodResult.unitPrice,
        totalPrice: prodResult.totalPrice,
        breakdown: {
          description: prodResult.product.name,
          rate: prodResult.unitPrice,
          unit: "per item",
          quantity: Number(payload.quantity) || 1,
        },
      };
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Price calculation failed." },
      { status: 400 }
    );
  }
}
