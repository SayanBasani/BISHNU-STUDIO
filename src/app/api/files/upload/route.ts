import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { validateFileBuffer, saveFileToStorage, FileCategory } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/db";
import { orderFiles } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json(
        { error: "Please log in to upload documents." },
        { status: 401 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = checkRateLimit(ip, "upload", { limit: 20, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Upload rate limit reached. Please wait ${rateCheck.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as FileCategory) || "general_document";

    if (!file) {
      return NextResponse.json(
        { error: "No file was selected for upload." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes, format, and size
    const validation = await validateFileBuffer(buffer, file.type, category);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Save to private storage with cryptographic safe name
    const stored = await saveFileToStorage(
      buffer,
      file.name,
      category,
      validation.mimeType!,
      validation.pageCount
    );

    // Retention: 30 days default
    const retentionMs = 30 * 24 * 60 * 60 * 1000;
    const retentionExpiresAt = Date.now() + retentionMs;

    // Record in database
    await db.insert(orderFiles).values({
      id: stored.fileId,
      uploadedByUserId: auth.user.id,
      originalFilename: stored.originalFilename,
      storedFilename: stored.storedFilename,
      storageKey: stored.storageKey,
      fileSize: stored.fileSize,
      mimeType: stored.mimeType,
      fileCategory: stored.fileCategory,
      pageCount: stored.pageCount || 1,
      retentionExpiresAt,
      isDeleted: false,
    });

    return NextResponse.json({
      success: true,
      file: {
        fileId: stored.fileId,
        originalFilename: stored.originalFilename,
        fileSize: stored.fileSize,
        mimeType: stored.mimeType,
        pageCount: stored.pageCount || 1,
        downloadUrl: `/api/files/download/${stored.fileId}`,
      },
    });
  } catch (error: any) {
    console.error("File upload failed:", error);
    return NextResponse.json(
      { error: "File upload failed. Please verify the document and try again." },
      { status: 500 }
    );
  }
}
