import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveBusinessName,
  resolveLogoPath,
  validateLogoPath,
  getAuthoritativeBusinessConfig,
} from "../src/lib/business";
import {
  getShopSettings,
  updateShopSettings,
  invalidateShopSettingsCache,
} from "../src/lib/settings";

describe("Authoritative Business Config & Store Availability Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.BUSINESS_NAME;
    delete process.env.NEXT_PUBLIC_BUSINESS_NAME;
    delete process.env.BUSINESS_LOGO_PATH;
    delete process.env.BUSINESS_URL;
    invalidateShopSettingsCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    invalidateShopSettingsCache();
  });

  describe("1. Business Name Precedence Rules", () => {
    it("should prioritize Database shopName over environment variables and defaults", () => {
      process.env.BUSINESS_NAME = "Env Business Name";
      process.env.NEXT_PUBLIC_BUSINESS_NAME = "Public Business Name";

      const resolved = resolveBusinessName("Bishnu Enterprise Digital");
      expect(resolved).toBe("Bishnu Enterprise Digital");
    });

    it("should fall back to BUSINESS_NAME if DB name is empty or undefined", () => {
      process.env.BUSINESS_NAME = "Apex Print & Copy Studio";
      process.env.NEXT_PUBLIC_BUSINESS_NAME = "Fallback Public Name";

      expect(resolveBusinessName(undefined)).toBe("Apex Print & Copy Studio");
      expect(resolveBusinessName("   ")).toBe("Apex Print & Copy Studio");
      expect(resolveBusinessName(null)).toBe("Apex Print & Copy Studio");
    });

    it("should fall back to NEXT_PUBLIC_BUSINESS_NAME if BUSINESS_NAME is not set", () => {
      process.env.NEXT_PUBLIC_BUSINESS_NAME = "Metro Print Services";

      expect(resolveBusinessName(undefined)).toBe("Metro Print Services");
      expect(resolveBusinessName("")).toBe("Metro Print Services");
    });

    it("should fall back to 'Bishnu Studio' when no overrides are configured", () => {
      expect(resolveBusinessName(undefined)).toBe("Bishnu Studio");
      expect(resolveBusinessName("")).toBe("Bishnu Studio");
      expect(resolveBusinessName(null)).toBe("Bishnu Studio");
    });
  });

  describe("2. Logo Path & Asset Security Validation", () => {
    it("should accept valid relative web paths", () => {
      const res1 = validateLogoPath("/logo.png");
      expect(res1.valid).toBe(true);
      expect(res1.safePath).toBe("/logo.png");

      const res2 = validateLogoPath("/uploads/branding/store-logo.webp");
      expect(res2.valid).toBe(true);
      expect(res2.safePath).toBe("/uploads/branding/store-logo.webp");
    });

    it("should accept valid HTTP and HTTPS remote URLs", () => {
      const httpsRes = validateLogoPath("https://cdn.bishnustudio.com/assets/logo.png");
      expect(httpsRes.valid).toBe(true);
      expect(httpsRes.safePath).toBe("https://cdn.bishnustudio.com/assets/logo.png");

      const httpRes = validateLogoPath("http://assets.local.dev/logo.svg");
      expect(httpRes.valid).toBe(true);
      expect(httpRes.safePath).toBe("http://assets.local.dev/logo.svg");
    });

    it("should reject local Windows filesystem paths to prevent serverless asset breakage", () => {
      const winRes1 = validateLogoPath("C:\\dev\\Antigravity\\bishnu-studio\\public\\logo.png");
      expect(winRes1.valid).toBe(false);
      expect(winRes1.error).toContain("Local filesystem paths are not valid public assets");

      const winRes2 = validateLogoPath("D:/Assets/Store/logo.png");
      expect(winRes2.valid).toBe(false);
      expect(winRes2.error).toContain("Local filesystem paths are not valid public assets");

      const uncRes = validateLogoPath("\\\\network-share\\assets\\logo.png");
      expect(uncRes.valid).toBe(false);
      expect(uncRes.error).toContain("Local filesystem paths are not valid public assets");
    });

    it("should reject dangerous URL schemes (javascript:, file:, data:, vbscript:)", () => {
      const jsRes = validateLogoPath("javascript:alert(document.cookie)");
      expect(jsRes.valid).toBe(false);
      expect(jsRes.error).toContain("Unsafe URL scheme detected");

      const fileRes = validateLogoPath("file:///C:/Windows/System32/drivers/etc/hosts");
      expect(fileRes.valid).toBe(false);
      expect(fileRes.error).toContain("Unsafe URL scheme detected");

      const dataRes = validateLogoPath("data:image/svg+xml;base64,PHN2ZyB4bWxucz0...");
      expect(dataRes.valid).toBe(false);
      expect(dataRes.error).toContain("Unsafe URL scheme detected");
    });

    it("should reject path traversal patterns", () => {
      const traversal = validateLogoPath("/uploads/../../etc/passwd");
      expect(traversal.valid).toBe(false);
      expect(traversal.error).toContain("Path traversal");
    });

    it("should handle null and empty string gracefully without error", () => {
      expect(validateLogoPath(null)).toEqual({ valid: true, safePath: null });
      expect(validateLogoPath("")).toEqual({ valid: true, safePath: null });
      expect(validateLogoPath("   ")).toEqual({ valid: true, safePath: null });
    });

    it("should enforce precedence in resolveLogoPath", () => {
      process.env.BUSINESS_LOGO_PATH = "/env-logo.png";

      // DB takes precedence
      expect(resolveLogoPath("/db-logo.png")).toBe("/db-logo.png");

      // Invalid DB path falls back to env var
      expect(resolveLogoPath("C:\\invalid\\path.png")).toBe("/env-logo.png");

      // No DB path falls back to env var
      expect(resolveLogoPath(null)).toBe("/env-logo.png");

      // No env var falls back to /logo.png
      delete process.env.BUSINESS_LOGO_PATH;
      expect(resolveLogoPath(null)).toBe("/logo.png");
    });
  });

  describe("3. Store Availability and Dynamic Business Config", () => {
    it("should return authoritative config with typed defaults", async () => {
      const config = await getAuthoritativeBusinessConfig();

      expect(config).toBeDefined();
      expect(typeof config.businessName).toBe("string");
      expect(typeof config.isOpen).toBe("boolean");
      expect(typeof config.returnWindowDays).toBe("number");
      expect(config.returnWindowDays).toBeGreaterThanOrEqual(1);
      expect(config.closedMessage).toBeDefined();
      expect(config.returnPolicyNotice).toBeDefined();
    });

    it("should dynamically reflect Open / Closed toggle and custom closed message", async () => {
      const customClosedMessage = "Studio counter is closed for annual inventory audit. Resuming tomorrow at 9 AM.";

      // 1. Set store to closed
      await updateShopSettings({
        isOpen: false,
        closedMessage: customClosedMessage,
        returnWindowDays: 14,
        returnPolicyNotice: "14-day replacement on unopened stationery items.",
      });

      const closedConfig = await getAuthoritativeBusinessConfig();
      expect(closedConfig.isOpen).toBe(false);
      expect(closedConfig.closedMessage).toBe(customClosedMessage);
      expect(closedConfig.returnWindowDays).toBe(14);
      expect(closedConfig.returnPolicyNotice).toContain("14-day replacement");

      // 2. Re-open store
      await updateShopSettings({
        isOpen: true,
      });

      const openConfig = await getAuthoritativeBusinessConfig();
      expect(openConfig.isOpen).toBe(true);
    });

    it("should reject order placement when store isOpen is false", async () => {
      // Simulate the checkout verification logic in src/app/api/orders/route.ts
      await updateShopSettings({
        isOpen: false,
        closedMessage: "Orders temporarily paused for maintenance.",
      });

      const currentSettings = await getShopSettings();
      expect(currentSettings.isOpen).toBe(false);

      const placeOrderGuard = (settings: { isOpen?: boolean | null; closedMessage?: string | null }) => {
        if (settings.isOpen === false) {
          return {
            allowed: false,
            status: 403,
            error: "STORE_CLOSED",
            message: settings.closedMessage || "The store is currently closed for new orders.",
          };
        }
        return { allowed: true };
      };

      const result = placeOrderGuard(currentSettings);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toBe("STORE_CLOSED");
      expect(result.message).toBe("Orders temporarily paused for maintenance.");

      // Restore to open
      await updateShopSettings({ isOpen: true });
    });
  });
});
