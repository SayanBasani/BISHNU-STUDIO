import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orderFiles } from "@/db/schema";
import { getFullPathFromStorageKey } from "@/lib/storage";
import { eq } from "drizzle-orm";
import fs from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    const fileRecords = await db
      .select()
      .from(orderFiles)
      .where(eq(orderFiles.id, fileId))
      .limit(1);

    if (fileRecords.length === 0) {
      return NextResponse.json(
        { error: "Requested document was not found." },
        { status: 404 }
      );
    }

    const fileRecord = fileRecords[0];

    // Public categories can be accessed without auth (e.g. avatar or product picture)
    const isPublicCategory =
      fileRecord.fileCategory === "profile_picture" ||
      fileRecord.fileCategory === "product_image";

    if (!isPublicCategory) {
      const auth = await getAuthSession();
      if (!auth?.user) {
        return NextResponse.json(
          { error: "Authentication required to access private documents." },
          { status: 401 }
        );
      }

      // Authorization Check:
      // Allow if user is admin/staff OR if user is the original uploader
      const isAdminOrStaff =
        auth.user.role === "admin" || auth.user.role === "staff";
      const isOwner = fileRecord.uploadedByUserId === auth.user.id;

      if (!isAdminOrStaff && !isOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to view or download this document." },
          { status: 403 }
        );
      }
    }

    if (fileRecord.isDeleted) {
      return NextResponse.json(
        { error: "This document has been removed under privacy retention policies." },
        { status: 410 }
      );
    }

    const fullDiskPath = getFullPathFromStorageKey(fileRecord.storageKey);
    if (!fs.existsSync(fullDiskPath)) {
      return NextResponse.json(
        { error: "File data not found on disk storage." },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.promises.readFile(fullDiskPath);

    const safeFilename = encodeURIComponent(fileRecord.originalFilename);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": fileRecord.mimeType,
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": isPublicCategory
          ? "public, max-age=86400, stale-while-revalidate=43200"
          : "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { error: "Failed to download document." },
      { status: 500 }
    );
  }
}
