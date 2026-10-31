import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  validateFileBuffer,
  saveFileToStorage,
  deleteFileFromStorage,
} from "@/lib/storage";
import { db } from "@/db";
import { users, orderFiles } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { createRequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// POST /api/account/avatar - Upload & set profile picture
export async function POST(req: NextRequest) {
  const timer = createRequestTimer(req);
  try {
    const auth = await timer.measure("authentication", async () => {
      return await getAuthSession();
    });

    if (!auth?.user) {
      return timer.finish(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return timer.finish(
        NextResponse.json(
          { error: "No image file was selected." },
          { status: 400 }
        )
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate file magic bytes, format (JPEG, PNG, WebP), and size (max 5MB)
    const validation = await timer.measure("validation.file_buffer", async () => {
      return await validateFileBuffer(
        buffer,
        file.type,
        "profile_picture"
      );
    });

    if (!validation.isValid) {
      return timer.finish(
        NextResponse.json({ error: validation.error }, { status: 400 })
      );
    }

    // Save to public profiles directory with cryptographic unique filename
    const stored = await timer.measure("storage.save_avatar", async () => {
      return await saveFileToStorage(
        buffer,
        file.name,
        "profile_picture",
        validation.mimeType!
      );
    });

    const downloadUrl = `/api/files/download/${stored.fileId}`;

    // Record in orderFiles table
    await timer.measure("database.order_files.insert", async () => {
      return await db.insert(orderFiles).values({
        id: stored.fileId,
        uploadedByUserId: auth.user.id,
        originalFilename: stored.originalFilename,
        storedFilename: stored.storedFilename,
        storageKey: stored.storageKey,
        fileSize: stored.fileSize,
        mimeType: stored.mimeType,
        fileCategory: "profile_picture",
        pageCount: 1,
        isDeleted: false,
      });
    });

    // Query current avatar URL before update to allow safe post-commit cleanup
    const currentUser = await timer.measure("database.user.get_current", async () => {
      return await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, auth.user.id))
        .limit(1);
    });

    const previousAvatarUrl = currentUser.length > 0 ? currentUser[0].avatarUrl : null;

    // Update user record with new avatarUrl FIRST (Requirement 3.5: Do not delete existing valid image until new reference is saved)
    await timer.measure("database.user.update_avatar", async () => {
      return await db
        .update(users)
        .set({
          avatarUrl: downloadUrl,
          updatedAt: Date.now(),
        })
        .where(eq(users.id, auth.user.id));
    });

    // Post-commit cleanup: safely delete previous avatar storage file if it existed
    if (previousAvatarUrl && previousAvatarUrl !== downloadUrl) {
      try {
        const match = previousAvatarUrl.match(/\/api\/files\/download\/(fil_[a-zA-Z0-9-]+)/);
        if (match) {
          const prevFileId = match[1];
          const prevFile = await db
            .select()
            .from(orderFiles)
            .where(eq(orderFiles.id, prevFileId))
            .limit(1);

          if (prevFile.length > 0) {
            await deleteFileFromStorage(prevFile[0].storageKey);
            await db
              .update(orderFiles)
              .set({ isDeleted: true })
              .where(eq(orderFiles.id, prevFileId));
          }
        }
      } catch (cleanupErr) {
        console.warn("Failed to clean up superseded avatar file:", cleanupErr);
      }
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "update_avatar",
      entityType: "user",
      entityId: auth.user.id,
      details: {
        fileId: stored.fileId,
        avatarUrl: downloadUrl,
        originalFilename: stored.originalFilename,
        fileSize: stored.fileSize,
      },
    });

    return timer.finish(
      NextResponse.json({
        success: true,
        message: "Profile picture updated successfully.",
        avatarUrl: downloadUrl,
      })
    );
  } catch (error: any) {
    console.error("Profile picture upload error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to upload profile picture. Please try again." },
        { status: 500 }
      )
    );
  }
}

// DELETE /api/account/avatar - Remove profile picture
export async function DELETE(req: NextRequest) {
  const timer = createRequestTimer(req);
  try {
    const auth = await timer.measure("authentication", async () => {
      return await getAuthSession();
    });

    if (!auth?.user) {
      return timer.finish(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const currentUser = await timer.measure("database.user.get_current", async () => {
      return await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, auth.user.id))
        .limit(1);
    });

    const prevUrl = currentUser.length > 0 ? currentUser[0].avatarUrl : null;

    // Reset avatarUrl to null in DB FIRST
    await timer.measure("database.user.clear_avatar", async () => {
      return await db
        .update(users)
        .set({
          avatarUrl: null,
          updatedAt: Date.now(),
        })
        .where(eq(users.id, auth.user.id));
    });

    // Post-commit cleanup: safely delete file on disk
    if (prevUrl) {
      try {
        const match = prevUrl.match(/\/api\/files\/download\/(fil_[a-zA-Z0-9-]+)/);
        if (match) {
          const prevFileId = match[1];
          const prevFile = await db
            .select()
            .from(orderFiles)
            .where(eq(orderFiles.id, prevFileId))
            .limit(1);

          if (prevFile.length > 0) {
            await deleteFileFromStorage(prevFile[0].storageKey);
            await db
              .update(orderFiles)
              .set({ isDeleted: true })
              .where(eq(orderFiles.id, prevFileId));
          }
        }
      } catch (cleanupErr) {
        console.warn("Failed to clean up deleted avatar file:", cleanupErr);
      }
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "remove_avatar",
      entityType: "user",
      entityId: auth.user.id,
    });

    return timer.finish(
      NextResponse.json({
        success: true,
        message: "Profile picture removed successfully.",
        avatarUrl: null,
      })
    );
  } catch (error: any) {
    console.error("Profile picture delete error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to remove profile picture." },
        { status: 500 }
      )
    );
  }
}
