import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getDeveloperProfile, updateDeveloperProfile } from "@/lib/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

const urlValidator = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Must be a valid URL starting with http:// or https://" }
  )
  .optional()
  .nullable();

const developerProfileUpdateSchema = z.object({
  developerName: z.string().min(2, "Developer name must be at least 2 characters"),
  professionalTitle: z.string().min(2, "Professional title is required"),
  biography: z.string().min(10, "Biography must be at least 10 characters"),
  skills: z.array(z.string()).default([]),
  projectContribution: z.string().optional().default(""),
  projectStartDate: z.string().optional().nullable(),
  projectCompletionDate: z.string().optional().nullable(),
  portfolioUrl: urlValidator,
  githubUrl: urlValidator,
  linkedinUrl: urlValidator,
  contactEmail: z
    .string()
    .trim()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Must be a valid email address",
    })
    .optional()
    .nullable(),
  avatarUrl: z.string().optional().nullable(),
  creditsStatement: z.string().min(5, "Credits statement must be at least 5 characters"),
  isPublished: z.boolean().default(true),
});

export async function GET() {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const profile = await getDeveloperProfile();
    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Admin fetch developer profile error:", error);
    return NextResponse.json(
      { error: "Failed to load developer profile." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = developerProfileUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const updated = await updateDeveloperProfile(validation.data, auth.user.id);

    return NextResponse.json({
      success: true,
      message: "Developer profile updated successfully.",
      profile: updated,
    });
  } catch (error: any) {
    console.error("Admin update developer profile error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update developer profile." },
      { status: 500 }
    );
  }
}
