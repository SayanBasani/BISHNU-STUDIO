import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orderFiles } from "@/db/schema";
import { getFullPathFromStorageKey } from "@/lib/storage";
import { eq } from "drizzle-orm";
import fs from "fs";
import { createRequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const timer = createRequestTimer(req);
  try {
    const { fileId } = params;
    const fileRecords = await timer.measure("database.file_lookup", async () => {
      return await db
        .select()
        .from(orderFiles)
        .where(eq(orderFiles.id, fileId))
        .limit(1);
    });

    if (fileRecords.length === 0) {
      return timer.finish(
        NextResponse.json(
          { error: "Requested document was not found." },
          { status: 404 }
        )
      );
    }

    const fileRecord = fileRecords[0];

    // Public categories can be accessed without auth (e.g. avatar or product picture)
    const isPublicCategory =
      fileRecord.fileCategory === "profile_picture" ||
      fileRecord.fileCategory === "product_image";

    if (!isPublicCategory) {
      const auth = await timer.measure("authentication", async () => {
        return await getAuthSession();
      });

      if (!auth?.user) {
        return timer.finish(
          NextResponse.json(
            { error: "Authentication required to access private documents." },
            { status: 401 }
          )
        );
      }

      // Authorization Check:
      // Allow if user is admin/staff OR if user is the original uploader
      const isAdminOrStaff =
        auth.user.role === "admin" || auth.user.role === "staff";
      const isOwner = fileRecord.uploadedByUserId === auth.user.id;

      if (!isAdminOrStaff && !isOwner) {
        return timer.finish(
          NextResponse.json(
            { error: "Access denied. You do not have permission to view or download this document." },
            { status: 403 }
          )
        );
      }
    }

    if (fileRecord.isDeleted) {
      return timer.finish(
        NextResponse.json(
          { error: "This document has been removed under privacy retention policies." },
          { status: 410 }
        )
      );
    }

    const fullDiskPath = getFullPathFromStorageKey(fileRecord.storageKey);
    if (!fs.existsSync(fullDiskPath)) {
      return timer.finish(
        NextResponse.json(
          { error: "File data not found on disk storage." },
          { status: 404 }
        )
      );
    }

    const fileBuffer = await timer.measure("storage.read_disk", async () => {
      return await fs.promises.readFile(fullDiskPath);
    });

    const safeFilename = encodeURIComponent(fileRecord.originalFilename);

    const res = new NextResponse(fileBuffer, {
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

    return timer.finish(res);
  } catch (error: any) {
    console.error("Document download error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to download document." },
        { status: 500 }
      )
    );
  }
}
