import { describe, it, expect, vi } from "vitest";
import { GET as getStatus } from "@/app/api/admin/database/status/route";
import { POST as postSwitch } from "@/app/api/admin/database/switch/route";
import { GET as getHistory } from "@/app/api/admin/database/history/route";
import { NextRequest } from "next/server";

// Mock authentication session
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getAuthSession: vi.fn().mockImplementation(async () => ({
      user: {
        id: "usr_admin_001",
        email: "admin@bishnustudio.com",
        role: "admin",
        fullName: "System Admin",
      },
    })),
  };
});

describe("BS-DB-01: Admin Database Management API Routes", () => {
  it("GET /api/admin/database/status should return control plane and health diagnostics", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/database/status");
    const res = await getStatus(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.controlPlane).toBeDefined();
    expect(body.controlPlane.mode).toBeDefined();
    expect(body.health).toBeDefined();
    expect(body.health.primary).toBeDefined();
    expect(body.health.fallback).toBeDefined();
    expect(body.hostingSafety).toBeDefined();
    expect(body.syncSummary).toBeDefined();
  });

  it("POST /api/admin/database/switch should reject request with missing confirmation", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/database/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMode: "maintenance",
        reason: "Test switch",
        confirmation: "WRONG",
      }),
    });

    const res = await postSwitch(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Explicit confirmation required/i);
  });

  it("GET /api/admin/database/history should return array of synchronization history", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/database/history");
    const res = await getHistory(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.history)).toBe(true);
  });
});
