import { NextResponse } from "next/server";
import { checkDatabaseReadiness } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkDatabaseReadiness();

  if (!result.ok) {
    return NextResponse.json(
      {
        status: "unhealthy",
        provider: result.provider,
        latencyMs: result.latencyMs,
        message: result.error || "Database connectivity check failed.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "healthy",
    provider: result.provider,
    latencyMs: result.latencyMs,
    timestamp: new Date().toISOString(),
  });
}
