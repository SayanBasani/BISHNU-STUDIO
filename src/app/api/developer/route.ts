import { NextResponse } from "next/server";
import { getDeveloperProfile } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getDeveloperProfile();

    if (!profile.isPublished) {
      return NextResponse.json({
        isPublished: false,
        profile: null,
      });
    }

    return NextResponse.json({
      isPublished: true,
      profile: {
        developerName: profile.developerName,
        professionalTitle: profile.professionalTitle,
        biography: profile.biography,
        skills: profile.skills,
        projectContribution: profile.projectContribution,
        projectStartDate: profile.projectStartDate,
        projectCompletionDate: profile.projectCompletionDate,
        portfolioUrl: profile.portfolioUrl,
        githubUrl: profile.githubUrl,
        linkedinUrl: profile.linkedinUrl,
        contactEmail: profile.contactEmail,
        avatarUrl: profile.avatarUrl,
        creditsStatement: profile.creditsStatement,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error("Public developer profile error:", error);
    return NextResponse.json(
      { error: "Failed to load developer profile." },
      { status: 500 }
    );
  }
}
