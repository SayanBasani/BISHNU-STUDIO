import { PDFDocument } from "pdf-lib";

export interface PdfInspectionResult {
  isValid: boolean;
  pageCount: number;
  error?: string;
}

/**
 * Safely inspects a PDF buffer on the server and extracts true page count.
 * Never trusts client-reported page counts.
 */
export async function inspectPdfBuffer(buffer: Buffer): Promise<PdfInspectionResult> {
  try {
    // Basic magic byte check: PDF files always start with %PDF- (0x25 0x50 0x44 0x46 0x2D)
    if (buffer.length < 5 || buffer.toString("utf-8", 0, 5) !== "%PDF-") {
      return {
        isValid: false,
        pageCount: 0,
        error: "The provided file is not a valid PDF document (missing %PDF- header).",
      };
    }

    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const pageCount = pdfDoc.getPageCount();

    if (pageCount <= 0) {
      return {
        isValid: false,
        pageCount: 0,
        error: "PDF document contains no readable pages.",
      };
    }

    return {
      isValid: true,
      pageCount,
    };
  } catch (err: any) {
    return {
      isValid: false,
      pageCount: 0,
      error: `Failed to parse PDF document: ${err?.message || "Corrupted or encrypted file"}`,
    };
  }
}
