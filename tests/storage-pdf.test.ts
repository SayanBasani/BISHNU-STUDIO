import { describe, it, expect } from "vitest";
import { inspectPdfBuffer } from "../src/lib/pdf";
import { validateFileBuffer } from "../src/lib/storage";
import { PDFDocument } from "pdf-lib";

describe("Server-Side PDF Inspection & Magic-Byte Validation", () => {
  it("should accurately count pages in a real PDF document generated on the server", async () => {
    // Generate an authentic 3-page PDF buffer in memory
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595.28, 841.89]); // A4 Page 1
    pdfDoc.addPage([595.28, 841.89]); // A4 Page 2
    pdfDoc.addPage([595.28, 841.89]); // A4 Page 3
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const result = await inspectPdfBuffer(pdfBuffer);
    expect(result.isValid).toBe(true);
    expect(result.pageCount).toBe(3);
  });

  it("should reject corrupted or counterfeit PDFs that lack %PDF- header", async () => {
    const fakePdfBuffer = Buffer.from("Hello world, this is just plain text disguised as a PDF!");
    const result = await inspectPdfBuffer(fakePdfBuffer);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("missing %PDF- header");
  });

  it("should enforce magic byte checking and reject mismatched file formats", async () => {
    // Fake image pretending to be JPEG
    const fakeImageBuffer = Buffer.from("This is not a real image format");
    const res = await validateFileBuffer(fakeImageBuffer, "image/jpeg", "pvc_document");

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("Unsupported file type");
  });

  it("should disallow PDF uploads when photo category is selected", async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([300, 300]);
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const res = await validateFileBuffer(pdfBuffer, "application/pdf", "photo");
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("Photo printing requires image files");
  });

  it("should reject files exceeding configured size limits", async () => {
    // Mock oversized buffer (e.g. 30MB)
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024);
    const res = await validateFileBuffer(largeBuffer, "application/pdf", "general_document");

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("exceeds the allowed maximum");
  });
});
