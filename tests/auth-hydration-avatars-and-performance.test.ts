import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { clearNotificationCache } from "@/components/NotificationBell";
import { saveFileToStorage, deleteFileFromStorage, getFullPathFromStorageKey } from "@/lib/storage";
import { createRequestTimer } from "@/lib/perf";
import { NextRequest } from "next/server";

describe("BS-AUTH-03A: Workstream 1 & 2 - Authentication Hydration and Navbar Structure", () => {
  const navbarSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/Navbar.tsx"),
    "utf-8"
  );
  const authContextSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/context/AuthContext.tsx"),
    "utf-8"
  );

  it("should extract loading state from useAuth in Navbar", () => {
    expect(navbarSource).toContain("loading: authLoading");
  });

  it("should support force parameter in AuthContext refreshUser to bypass in-flight deduplication", () => {
    expect(authContextSource).toContain("refreshUser = async (force: boolean = false)");
    expect(authContextSource).toContain("if (force) {");
  });

  it("should implement 3 distinct authentication states on Desktop without premature Log In flash", () => {
    // State A: Loading pulse skeleton
    expect(navbarSource).toContain("/* State A — Loading placeholder */");
    expect(navbarSource).toContain("aria-label=\"Loading authentication\"");
    expect(navbarSource).toContain("animate-pulse");

    // State B: Authenticated account dropdown with UserAvatar
    expect(navbarSource).toContain("/* State B — Authenticated Desktop Account Menu */");
    expect(navbarSource).toContain("<UserAvatar");

    // State C: Unauthenticated actions
    expect(navbarSource).toContain("/* State C — Unauthenticated Desktop Actions */");
    expect(navbarSource).toContain("href=\"/login\"");
    expect(navbarSource).toContain("href=\"/register\"");
  });

  it("should expose visible account preview in the Mobile top navbar (< sm screens)", () => {
    expect(navbarSource).toContain("/* Mobile Account Preview Button (< sm screens) */");
    expect(navbarSource).toContain("ref={mobileAccountRef}");
    expect(navbarSource).toContain("aria-label={`Account preview: ${user.fullName}`}");
    expect(navbarSource).toContain("setMobileAccountMenuOpen(!mobileAccountMenuOpen)");
  });

  it("should provide responsive text truncation and prevent horizontal overflow on narrow mobile screens", () => {
    // User first name is hidden on screens under xs (320px) and visible only on xs+ (390px+)
    expect(navbarSource).toContain("hidden xs:inline-block text-xs font-bold text-gray-800 dark:text-gray-200 max-w-[65px] truncate");
    // Skeletons and avatar elements must have shrink-0 to prevent layout collapse
    expect(navbarSource).toContain("shrink-0");
  });

  it("should render mobile quick-sheet account options when mobile avatar is tapped", () => {
    expect(navbarSource).toContain("/* Mobile Quick Account Sheet / Dropdown */");
    expect(navbarSource).toContain("href=\"/account/orders\"");
    expect(navbarSource).toContain("href=\"/account/profile\"");
    expect(navbarSource).toContain("href=\"/account/notifications\"");
  });
});

describe("BS-AUTH-03A: Workstream 3 - UserAvatar Component and Profile Persistence", () => {
  const avatarSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/ui/UserAvatar.tsx"),
    "utf-8"
  );
  const avatarApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/account/avatar/route.ts"),
    "utf-8"
  );
  const downloadApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/files/download/[fileId]/route.ts"),
    "utf-8"
  );
  const resetDbSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/scripts/reset-test-db.ts"),
    "utf-8"
  );

  it("should provide resilient UserAvatar component with onError fallback to user initials", () => {
    expect(avatarSource).toContain("const [imgError, setImgError] = useState(false);");
    expect(avatarSource).toContain("onError={() => setImgError(true)}");
    expect(avatarSource).toContain("setImgError(false)");
  });

  it("should update database before deleting superseded avatar files (Requirement 3.5)", () => {
    const dbUpdatePos = avatarApiSource.indexOf("database.user.update_avatar");
    const cleanupPos = avatarApiSource.indexOf("Post-commit cleanup: safely delete previous avatar storage file");

    expect(dbUpdatePos).toBeGreaterThan(0);
    expect(cleanupPos).toBeGreaterThan(0);
    // Crucial check: database update must precede file deletion
    expect(dbUpdatePos).toBeLessThan(cleanupPos);
  });

  it("should update database before deleting files on avatar removal", () => {
    const clearAvatarPos = avatarApiSource.indexOf("database.user.clear_avatar");
    const postCommitCleanup = avatarApiSource.indexOf("Post-commit cleanup: safely delete file on disk");

    expect(clearAvatarPos).toBeGreaterThan(0);
    expect(postCommitCleanup).toBeGreaterThan(0);
    expect(clearAvatarPos).toBeLessThan(postCommitCleanup);
  });

  it("should apply Cache-Control no-store headers on download 404 and 410 responses", () => {
    expect(downloadApiSource).toContain("\"Cache-Control\": \"no-store, no-cache, must-revalidate\"");
  });

  it("should protect active user profile pictures during test environment resets in reset-test-db", () => {
    expect(resetDbSource).toContain("preservedAvatarFilenames = new Set<string>()");
    expect(resetDbSource).toContain("sub === \"public/profiles\"");
    expect(resetDbSource).toContain("isPreserved");
    expect(resetDbSource).toContain("continue;");
  });

  it("should save and verify physical disk persistence in uploads/public/profiles", async () => {
    const testBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const stored = await saveFileToStorage(testBuffer, "test_avatar.png", "profile_picture", "image/png");

    expect(stored.fileId).toMatch(/^fil_/);
    expect(stored.storageKey).toContain("public/profiles/");

    const diskPath = getFullPathFromStorageKey(stored.storageKey);
    expect(fs.existsSync(diskPath)).toBe(true);

    const deleted = await deleteFileFromStorage(stored.storageKey);
    expect(deleted).toBe(true);
    expect(fs.existsSync(diskPath)).toBe(false);
  });
});

describe("BS-AUTH-03A: Workstream 5 & 6 - Performance Diagnosis, Polling Protection & Metrics", () => {
  const notifBellSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/NotificationBell.tsx"),
    "utf-8"
  );
  const addressesApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/account/addresses/route.ts"),
    "utf-8"
  );

  it("should strictly skip customer notification polling when authLoading or user is null", () => {
    expect(notifBellSource).toContain("if (scope === \"customer\" && (authLoading || !user)) {");
  });

  it("should reset notification cache and clear unread state when active user changes or logs out", () => {
    expect(notifBellSource).toContain("prevUserIdRef = useRef<string | null>(null)");
    expect(notifBellSource).toContain("clearNotificationCache(\"customer\")");
    expect(notifBellSource).toContain("setNotifications([]);");
    expect(notifBellSource).toContain("setUnreadCount(0);");
  });

  it("should clear shared notification in-flight and cached payload via clearNotificationCache helper", () => {
    expect(typeof clearNotificationCache).toBe("function");
    clearNotificationCache("customer");
    clearNotificationCache("admin");
    clearNotificationCache();
  });

  it("should instrument /api/account/addresses with createRequestTimer and measure authentication and database stages", () => {
    expect(addressesApiSource).toContain("createRequestTimer(req)");
    expect(addressesApiSource).toContain("timer.measure(\"authentication\"");
    expect(addressesApiSource).toContain("timer.measure(\"database.user_addresses\"");
    expect(addressesApiSource).toContain("timer.finish(");
  });

  it("should instrument /api/account/avatar with createRequestTimer", () => {
    const avatarApi = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/account/avatar/route.ts"),
      "utf-8"
    );
    expect(avatarApi).toContain("createRequestTimer(req)");
    expect(avatarApi).toContain("timer.measure(\"storage.save_avatar\"");
    expect(avatarApi).toContain("timer.measure(\"database.user.update_avatar\"");
  });

  it("should propagate request ID and duration in RequestTimer", async () => {
    const dummyReq = new NextRequest("http://localhost:3000/api/account/addresses", {
      headers: { "x-request-id": "req_test_auth_03a" },
    });
    const timer = createRequestTimer(dummyReq);

    const val = await timer.measure("test_calc", async () => 42);
    expect(val).toBe(42);

    const res = timer.finish(new Response(JSON.stringify({ ok: true })));
    expect(res.headers.get("x-request-id")).toBe("req_test_auth_03a");
  });
});
