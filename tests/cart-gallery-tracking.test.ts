import { describe, it, expect, beforeAll } from "vitest";
import { getCartLineKey, deduplicateCartItems } from "../src/context/CartContext";
import { CartItem } from "../src/types";
import fs from "fs";
import path from "path";

describe("Cart Deduplication, Product Image Preview, Order Tracking Journey & Timeline", () => {
  /* ========================================================================
   * PART 1: CART DEDUPLICATION & MERGING
   * ======================================================================== */
  describe("PART 1: Cart Deduplication & Merging Logic", () => {
    it("should generate identical line keys for identical products regardless of config key ordering", () => {
      const itemA = {
        itemType: "product",
        productId: "prod_101",
        configuration: { size: "A4", paper: "glossy" },
      };
      const itemB = {
        itemType: "product",
        productId: "prod_101",
        configuration: { paper: "glossy", size: "A4" }, // Swapped key order
      };

      const keyA = getCartLineKey(itemA);
      const keyB = getCartLineKey(itemB);

      expect(keyA).toBe(keyB);
      expect(keyA).toBe('prod_prod_101_{"paper":"glossy","size":"A4"}');
    });

    it("should generate distinct line keys for different products or different variant options", () => {
      const prodA = {
        itemType: "product",
        productId: "prod_101",
        configuration: { finish: "matte" },
      };
      const prodB = {
        itemType: "product",
        productId: "prod_101",
        configuration: { finish: "glossy" },
      };
      const prodC = {
        itemType: "product",
        productId: "prod_102",
        configuration: { finish: "matte" },
      };

      const keyA = getCartLineKey(prodA);
      const keyB = getCartLineKey(prodB);
      const keyC = getCartLineKey(prodC);

      expect(keyA).not.toBe(keyB);
      expect(keyA).not.toBe(keyC);
      expect(keyB).not.toBe(keyC);
    });

    it("should deduplicate print services taking into account serviceId, options, and files while ignoring transient keys", () => {
      const serviceA = {
        itemType: "pvc_card",
        serviceId: "srv_pvc",
        configuration: { documentType: "aadhaar", _timestamp: 123456789, uploadedFiles: ["preview.jpg"] },
        fileIds: ["file_1", "file_2"],
      };
      const serviceB = {
        itemType: "pvc_card",
        serviceId: "srv_pvc",
        configuration: { documentType: "aadhaar", _timestamp: 987654321, uploadedFiles: ["different.jpg"] },
        fileIds: ["file_2", "file_1"], // Swapped file order
      };
      const serviceDifferent = {
        itemType: "pvc_card",
        serviceId: "srv_pvc",
        configuration: { documentType: "pan" },
        fileIds: ["file_1", "file_2"],
      };

      const keyA = getCartLineKey(serviceA);
      const keyB = getCartLineKey(serviceB);
      const keyDiff = getCartLineKey(serviceDifferent);

      expect(keyA).toBe(keyB);
      expect(keyA).not.toBe(keyDiff);
    });

    it("should correctly merge duplicate cart items, accumulating quantity and recalculating total price", () => {
      const rawCart: CartItem[] = [
        {
          id: "cart_item_1",
          itemType: "product",
          name: "Photo Frame 8x10",
          description: "Studio Wood Frame",
          quantity: 2,
          unitPrice: 350,
          totalPrice: 700,
          productId: "prod_frame_01",
          configuration: {},
        },
        {
          id: "cart_item_2",
          itemType: "product",
          name: "Photo Frame 8x10",
          description: "Studio Wood Frame",
          quantity: 3,
          unitPrice: 350,
          totalPrice: 1050,
          productId: "prod_frame_01",
          configuration: {},
        },
        {
          id: "cart_item_3",
          itemType: "product",
          name: "Glossy Photo Paper",
          description: "260 GSM Premium Glossy",
          quantity: 1,
          unitPrice: 150,
          totalPrice: 150,
          productId: "prod_paper_01",
          configuration: {},
        },
      ];

      const merged = deduplicateCartItems(rawCart);

      expect(merged).toHaveLength(2);
      const frameLine = merged.find((item) => item.productId === "prod_frame_01");
      const paperLine = merged.find((item) => item.productId === "prod_paper_01");

      expect(frameLine).toBeDefined();
      expect(frameLine?.quantity).toBe(5); // 2 + 3
      expect(frameLine?.totalPrice).toBe(1750); // 350 * 5

      expect(paperLine).toBeDefined();
      expect(paperLine?.quantity).toBe(1);
      expect(paperLine?.totalPrice).toBe(150);
    });

    it("should enforce stock limits when adding items to cart and prevent duplicate lines on shop pages", () => {
      const shopPagePath = path.resolve(process.cwd(), "src/app/shop/page.tsx");
      const shopPageCode = fs.readFileSync(shopPagePath, "utf-8");

      // Verify shop card Add to Cart debouncing and quantity feedback
      expect(shopPageCode).toContain("addingId === product.id");
      expect(shopPageCode).toContain("maxStock: product.stockQuantity");
      expect(shopPageCode).toContain("In Cart");

      // Verify product detail page Add to Cart debouncing and quantity feedback
      const detailPagePath = path.resolve(process.cwd(), "src/app/shop/[id]/page.tsx");
      const detailPageCode = fs.readFileSync(detailPagePath, "utf-8");

      expect(detailPageCode).toContain("if (adding || isOutOfStock) return");
      expect(detailPageCode).toContain("maxStock: product.stockQuantity");
      expect(detailPageCode).toContain("Cart quantity updated");
    });

    it("should enforce server-side cart deduplication before price verification in /api/orders", () => {
      const apiOrdersPath = path.resolve(process.cwd(), "src/app/api/orders/route.ts");
      const apiOrdersCode = fs.readFileSync(apiOrdersPath, "utf-8");

      // Verify server deduplication guard
      expect(apiOrdersCode).toContain("Server-side cart deduplication guard");
      expect(apiOrdersCode).toContain("mergedInputItems");
      expect(apiOrdersCode).toContain("existing.quantity += rawItem.quantity");
    });
  });

  /* ========================================================================
   * PART 2: PRODUCT IMAGE PREVIEW & LIGHTBOX REDESIGN
   * ======================================================================== */
  describe("PART 2: Product Image Preview & Lightbox", () => {
    it("should use a fixed responsive height container with object-contain to prevent image cropping", () => {
      const detailPagePath = path.resolve(process.cwd(), "src/app/shop/[id]/page.tsx");
      const code = fs.readFileSync(detailPagePath, "utf-8");

      // Main image container fixed responsive height
      expect(code).toContain("h-[380px] sm:h-[450px] lg:h-[480px]");
      // Neutral theme-aware background
      expect(code).toContain("bg-white dark:bg-slate-900");
      // Main image fit
      expect(code).toContain("max-h-full max-w-full object-contain");
      // Fallback image on error
      expect(code).toContain("onError");
    });

    it("should provide accessible thumbnail navigation and active image indicators", () => {
      const detailPagePath = path.resolve(process.cwd(), "src/app/shop/[id]/page.tsx");
      const code = fs.readFileSync(detailPagePath, "utf-8");

      // Thumbnail carousel strip
      expect(code).toContain('role="tablist"');
      expect(code).toContain('role="tab"');
      expect(code).toContain("aria-selected=");
      expect(code).toContain("w-20 h-20");
      expect(code).toContain("max-w-full max-h-full object-contain");
      // Active thumbnail ring
      expect(code).toContain("border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/30");
    });

    it("should implement a fullscreen Lightbox modal with keyboard navigation and scroll locking", () => {
      const detailPagePath = path.resolve(process.cwd(), "src/app/shop/[id]/page.tsx");
      const code = fs.readFileSync(detailPagePath, "utf-8");

      // Lightbox state & controls
      expect(code).toContain("lightboxOpen");
      expect(code).toContain('role="dialog"');
      expect(code).toContain('aria-modal="true"');
      expect(code).toContain("bg-black/90 backdrop-blur-md");
      // Body scroll lock
      expect(code).toContain('document.body.style.overflow = "hidden"');
      expect(code).toContain('document.body.style.overflow = ""');
      // Escape and arrow key navigation
      expect(code).toContain('e.key === "Escape"');
      expect(code).toContain('e.key === "ArrowLeft"');
      expect(code).toContain('e.key === "ArrowRight"');
      // Backdrop click dismissal
      expect(code).toContain("onClick={() => setLightboxOpen(false)}");
      expect(code).toContain("e.stopPropagation()");
    });
  });

  /* ========================================================================
   * PART 3: FULFILLMENT TRACKING PROGRESS JOURNEY
   * ======================================================================== */
  describe("PART 3: Fulfillment Tracking Progress Journey", () => {
    it("should map real order states to the 5 standard fulfillment milestones", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Verify the 5 milestones
      expect(code).toContain('key: "placed"');
      expect(code).toContain('key: "confirmed"');
      expect(code).toContain('key: "processing"');
      expect(code).toContain('key: "ready"');
      expect(code).toContain('key: "completed"');

      // Verify state mapping
      expect(code).toContain('case "completed":');
      expect(code).toContain("activeMilestoneIndex = 4");
      expect(code).toContain('case "ready_for_collection":');
      expect(code).toContain('case "out_for_delivery":');
      expect(code).toContain("activeMilestoneIndex = 3");
      expect(code).toContain('case "processing":');
      expect(code).toContain("activeMilestoneIndex = 2");
      expect(code).toContain('case "confirmed":');
      expect(code).toContain("activeMilestoneIndex = 1");
    });

    it("should dynamically tailor milestone labels for home delivery vs store pickup", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Store pickup vs Home delivery
      expect(code).toContain('isDelivery ? "Out for Delivery" : "Ready for Pickup"');
      expect(code).toContain('isDelivery ? "Delivered" : "Collected"');
      expect(code).toContain('isDelivery ? "Courier dispatched" : "Studio counter"');
    });

    it("should not show fake progress for cancelled orders and provide clear cancellation banners", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Cancelled state check
      expect(code).toContain('const isCancelled = order.orderStatus === "cancelled"');
      // Milestone progression halted on cancelled
      expect(code).toContain("if (!isCancelled)");
      // Alert banners
      expect(code).toContain("This order has been cancelled.");
      expect(code).toContain("bg-rose-50 dark:bg-rose-950/40");
    });

    it("should support restrained breathing pulse for active step and respect reduced-motion", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Active step pulse with motion-reduce guard
      expect(code).toContain("animate-pulse motion-reduce:animate-none");
      // Animated connecting line with motion-reduce guard
      expect(code).toContain("transition-all duration-700 ease-in-out motion-reduce:transition-none");
      // Completed step checkmark
      expect(code).toContain("bg-emerald-600 text-white");
    });
  });

  /* ========================================================================
   * PART 4: CHRONOLOGICAL ACTIVITY TIMELINE
   * ======================================================================== */
  describe("PART 4: Chronological Activity Timeline", () => {
    it("should synthesize events from order placement, payment submissions, and status history", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Baseline order placement event
      expect(code).toContain("Order Placed & Logged");
      expect(code).toContain("base_${order.id}");

      // Payment proof events
      expect(code).toContain("sub.status === \"verified\"");
      expect(code).toContain("UPI Payment Confirmed");
      expect(code).toContain("Payment Proof Rejected");
      expect(code).toContain("Payment Proof Submitted");

      // Timeline events from status history
      expect(code).toContain("rawTimeline");
      expect(code).toContain("Print Room Processing Started");
      expect(code).toContain("Ready for Counter Pickup");
      expect(code).toContain("Dispatched for Doorstep Delivery");
    });

    it("should sort activity events strictly in ascending chronological order", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Strict chronological sorting
      expect(code).toContain("activityEvents.sort((a, b) => a.timestamp - b.timestamp)");
    });

    it("should display distinct status icons and theme-safe colors across dark and light modes", () => {
      const orderDetailPath = path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx");
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Timeline container theme-safe tokens
      expect(code).toContain("bg-white dark:bg-slate-900");
      expect(code).toContain("border-slate-200 dark:border-slate-800");
      // Timestamp formatting
      expect(code).toContain('toLocaleDateString("en-IN"');
    });
  });
});
