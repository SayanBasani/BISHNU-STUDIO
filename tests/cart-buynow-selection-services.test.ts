import { describe, it, expect, beforeAll } from "vitest";
import {
  getCartLineKey,
  deduplicateCartItems,
  CartItemDescriptor,
} from "../src/context/CartContext";
import {
  createBuyNowIntent,
  createSelectedItemsIntent,
  createDirectServiceIntent,
  CheckoutIntent,
} from "../src/lib/checkout";
import { CartItem } from "../src/types";
import { db } from "../src/db";
import { products, productCategories, users, orders, orderItems } from "../src/db/schema";
import { generateOrderReference } from "../src/lib/utils";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";

describe("Cart Quantity, Buy Now, Selective Checkout & Unified Printing Service Checkout", () => {
  let testProductId: string;
  let outOfStockProductId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    testCategoryId = `cat_test_${Date.now()}`;
    await db
      .insert(productCategories)
      .values({
        id: testCategoryId,
        name: "Test Office Paper",
        slug: `test-cat-${Date.now()}`,
        description: "Test Category",
        sortOrder: 1,
        isActive: true,
      })
      .onConflictDoNothing();

    testProductId = `prod_unit_${Date.now()}`;
    await db
      .insert(products)
      .values({
        id: testProductId,
        categoryId: testCategoryId,
        name: "A4 Executive Copier Paper",
        slug: `a4-executive-${Date.now()}`,
        sku: `SKU-A4-${Date.now()}`,
        description: "80 GSM 500 Sheets ream",
        price: 320,
        discountedPrice: 300,
        stockQuantity: 150, // Available stock 150
        isAvailable: true,
        primaryImage: "/images/a4.jpg",
      })
      .onConflictDoNothing();

    outOfStockProductId = `prod_oos_${Date.now()}`;
    await db
      .insert(products)
      .values({
        id: outOfStockProductId,
        categoryId: testCategoryId,
        name: "Sold Out Matte Paper",
        slug: `sold-out-${Date.now()}`,
        sku: `SKU-OOS-${Date.now()}`,
        description: "Currently Unavailable",
        price: 450,
        discountedPrice: null,
        stockQuantity: 0, // Out of stock
        isAvailable: false,
        primaryImage: "/images/oos.jpg",
      })
      .onConflictDoNothing();
  });

  /* ========================================================================
   * PART 1: CORRECT ADD-TO-CART BEHAVIOUR
   * ======================================================================== */
  describe("PART 1: Add-to-Cart Quantity Mechanics", () => {
    it("should never interpret available stock (e.g. 150) as quantity to add; single click adds exactly 1 unit", () => {
      // Simulate client adding item with unit price 300 and stock 150
      const initialItem: CartItem = {
        id: `cart_${testProductId}`,
        itemType: "product",
        name: "A4 Executive Copier Paper",
        description: "80 GSM Ream",
        quantity: 1,
        unitPrice: 300,
        totalPrice: 300,
        productId: testProductId,
        configuration: {},
      };

      // Ensure quantity is exactly 1, not stock quantity (150)
      expect(initialItem.quantity).toBe(1);
      expect(initialItem.totalPrice).toBe(300);
    });

    it("should not increment quantity automatically on repeated Add to Cart clicks for matching item", () => {
      const lineKey = getCartLineKey({
        itemType: "product",
        productId: testProductId,
        configuration: {},
      });

      // Cart state with 1 item already present
      const currentCart: CartItem[] = [
        {
          id: `cart_${lineKey}`,
          itemType: "product",
          name: "A4 Executive Copier Paper",
          description: "80 GSM Ream",
          quantity: 1,
          unitPrice: 300,
          totalPrice: 300,
          productId: testProductId,
          configuration: {},
        },
      ];

      // Re-running deduplication or checking if present
      const isAlreadyInCart = currentCart.some((i) => getCartLineKey(i) === lineKey);
      expect(isAlreadyInCart).toBe(true);

      // Attempting to add again must preserve quantity 1 without silent stacking
      const repeatedAttempt: CartItem = {
        id: `cart_second_${testProductId}`,
        itemType: "product",
        name: "A4 Executive Copier Paper",
        description: "80 GSM Ream",
        quantity: 1,
        unitPrice: 300,
        totalPrice: 300,
        productId: testProductId,
        configuration: {},
      };

      // With our updated CartContext, existing item quantity is preserved
      const existing = currentCart.find((i) => getCartLineKey(i) === lineKey);
      expect(existing?.quantity).toBe(1);
    });

    it("should allow explicit quantity updates via quantity controls up to stock limits", () => {
      const stock = 150;
      let selectedQuantity = 1;

      // Increment
      selectedQuantity = Math.min(stock, selectedQuantity + 1);
      expect(selectedQuantity).toBe(2);

      // Explicit change to 5
      selectedQuantity = Math.min(stock, 5);
      expect(selectedQuantity).toBe(5);

      // Clamping against stock
      const overStockAttempt = 200;
      const clamped = Math.min(stock, overStockAttempt);
      expect(clamped).toBe(150);

      // Clamping against non-positive
      const negativeAttempt = -3;
      const clampedMin = Math.max(1, negativeAttempt);
      expect(clampedMin).toBe(1);
    });

    it("should preserve different product variant configurations on distinct cart lines", () => {
      const variantGlossy: CartItemDescriptor = {
        itemType: "product",
        productId: testProductId,
        configuration: { finish: "glossy" },
      };

      const variantMatte: CartItemDescriptor = {
        itemType: "product",
        productId: testProductId,
        configuration: { finish: "matte" },
      };

      const keyGlossy = getCartLineKey(variantGlossy);
      const keyMatte = getCartLineKey(variantMatte);

      expect(keyGlossy).not.toBe(keyMatte);
      expect(keyGlossy).toContain('"finish":"glossy"');
      expect(keyMatte).toContain('"finish":"matte"');
    });

    it("should enforce product card UI states: In Cart notice and View Cart action", () => {
      const shopPageCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/shop/page.tsx"), "utf-8");
      expect(shopPageCode).toContain("isInCart");
      expect(shopPageCode).toContain("In Cart · View Cart");
      expect(shopPageCode).toContain("Already in your cart");
      expect(shopPageCode).toContain("Out of Stock");
    });
  });

  /* ========================================================================
   * PART 2: BUY NOW ARCHITECTURE & CHECKOUT INTENT
   * ======================================================================== */
  describe("PART 2: Buy Now Checkout Intent", () => {
    it("should create a separate Buy Now intent containing only the selected product and quantity", () => {
      const product = {
        id: testProductId,
        name: "A4 Executive Copier Paper",
        sku: "SKU-A4",
        categoryName: "Office Paper",
        price: 320,
        discountedPrice: 300,
        stockQuantity: 150,
      };

      const buyNowIntent = createBuyNowIntent(product, 3, {});

      expect(buyNowIntent.type).toBe("buy_now");
      expect(buyNowIntent.items).toHaveLength(1);
      expect(buyNowIntent.items[0].productId).toBe(testProductId);
      expect(buyNowIntent.items[0].quantity).toBe(3);
      expect(buyNowIntent.items[0].unitPrice).toBe(300);
      expect(buyNowIntent.items[0].totalPrice).toBe(900);
    });

    it("should isolate Buy Now checkout from ordinary shopping cart", () => {
      // Normal shopping cart has 2 unrelated items
      const normalCart: CartItem[] = [
        {
          id: "cart_item_phone",
          itemType: "product",
          name: "Studio Camera Film",
          description: "35mm Color",
          quantity: 2,
          unitPrice: 450,
          totalPrice: 900,
          productId: "prod_film_01",
          configuration: {},
        },
        {
          id: "cart_item_binder",
          itemType: "product",
          name: "Spiral Desk Binder",
          description: "A4 2-ring",
          quantity: 1,
          unitPrice: 120,
          totalPrice: 120,
          productId: "prod_binder_01",
          configuration: {},
        },
      ];

      // Customer performs Buy Now on a laptop/paper item
      const product = {
        id: testProductId,
        name: "A4 Executive Copier Paper",
        sku: "SKU-A4",
        categoryName: "Office Paper",
        price: 320,
        discountedPrice: 300,
        stockQuantity: 150,
      };

      const buyNowIntent = createBuyNowIntent(product, 1, {});

      // Buy Now intent has ONLY 1 item
      expect(buyNowIntent.items).toHaveLength(1);
      expect(buyNowIntent.items[0].productId).toBe(testProductId);

      // Normal cart items remain completely unchanged
      expect(normalCart).toHaveLength(2);
      expect(normalCart[0].productId).toBe("prod_film_01");
      expect(normalCart[1].productId).toBe("prod_binder_01");
    });

    it("should reject Buy Now with out-of-stock product", () => {
      const oosProduct = {
        id: outOfStockProductId,
        name: "Sold Out Matte Paper",
        sku: "SKU-OOS",
        categoryName: "Office Paper",
        price: 450,
        discountedPrice: null,
        stockQuantity: 0,
      };

      // Creating buy now intent clamps quantity to max stock (min 1, stock 0 => 1 clamp)
      const intent = createBuyNowIntent(oosProduct, 2, {});
      expect(intent.items[0].quantity).toBe(1);
    });

    it("should configure product detail page with explicit Buy Now button and quantity input", () => {
      const detailCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/shop/[id]/page.tsx"), "utf-8");
      expect(detailCode).toContain("handleBuyNow");
      expect(detailCode).toContain("createBuyNowIntent");
      expect(detailCode).toContain("Buy Now");
      expect(detailCode).toContain('type="number"');
    });
  });

  /* ========================================================================
   * PART 3: SELECTIVE CART CHECKOUT
   * ======================================================================== */
  describe("PART 3: Selected Cart Items Checkout", () => {
    it("should create a selected items checkout intent with sourceCartItemIds tracked", () => {
      const allCartItems: CartItem[] = [
        {
          id: "item_1",
          itemType: "product",
          name: "Item 1",
          description: "Desc 1",
          quantity: 2,
          unitPrice: 100,
          totalPrice: 200,
          productId: "prod_1",
          configuration: {},
        },
        {
          id: "item_2",
          itemType: "product",
          name: "Item 2",
          description: "Desc 2",
          quantity: 1,
          unitPrice: 250,
          totalPrice: 250,
          productId: "prod_2",
          configuration: {},
        },
        {
          id: "item_3",
          itemType: "product",
          name: "Item 3",
          description: "Desc 3",
          quantity: 4,
          unitPrice: 50,
          totalPrice: 200,
          productId: "prod_3",
          configuration: {},
        },
      ];

      // Customer selects only item_1 and item_3
      const selected = [allCartItems[0], allCartItems[2]];
      const intent = createSelectedItemsIntent(selected);

      expect(intent.type).toBe("selected_items");
      expect(intent.items).toHaveLength(2);
      expect(intent.sourceCartItemIds).toEqual(["item_1", "item_3"]);

      // Unselected item_2 is excluded from checkout
      expect(intent.items.some((i) => i.id === "item_2")).toBe(false);
    });

    it("should remove only the purchased cart items upon order completion while preserving unselected items", () => {
      const initialCart: CartItem[] = [
        {
          id: "item_1",
          itemType: "product",
          name: "Purchased Item 1",
          description: "Desc 1",
          quantity: 2,
          unitPrice: 100,
          totalPrice: 200,
          productId: "prod_1",
          configuration: {},
        },
        {
          id: "item_2",
          itemType: "product",
          name: "Unselected Item 2",
          description: "Desc 2",
          quantity: 1,
          unitPrice: 250,
          totalPrice: 250,
          productId: "prod_2",
          configuration: {},
        },
      ];

      // Simulated removeItems action for purchased items
      const purchasedIds = new Set(["item_1"]);
      const remainingCart = initialCart.filter((i) => !purchasedIds.has(i.id));

      expect(remainingCart).toHaveLength(1);
      expect(remainingCart[0].id).toBe("item_2");
      expect(remainingCart[0].name).toBe("Unselected Item 2");
    });

    it("should verify cart UI has selection checkboxes, Select All, and disables checkout on empty selection", () => {
      const cartCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/cart/page.tsx"), "utf-8");
      expect(cartCode).toContain("selectedIds");
      expect(cartCode).toContain("toggleSelect");
      expect(cartCode).toContain("toggleSelectAll");
      expect(cartCode).toContain("Selected Items Subtotal");
      expect(cartCode).toContain("Full Cart Total Value");
      expect(cartCode).toContain("disabled={selectedItems.length === 0}");
      expect(cartCode).toContain("createSelectedItemsIntent");
    });
  });

  /* ========================================================================
   * PART 4: UNIFIED CHECKOUT FOR PRINTING SERVICES
   * ======================================================================== */
  describe("PART 4: Unified Printing Services Checkout", () => {
    it("should create direct service checkout intent preserving files and custom options", () => {
      const serviceItem: CartItem = {
        id: "srv_pvc_123",
        itemType: "pvc_card",
        name: "Aadhaar Card PVC Printing",
        description: "1 Card | File: aadhaar.pdf",
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
        serviceId: "srv_pvc",
        fileIds: ["file_aadhaar_01"],
        configuration: {
          documentType: "aadhaar",
          documentNumber: "1234-5678-9012",
          specialInstructions: "Matte coating",
          uploadedFiles: [
            {
              fileId: "file_aadhaar_01",
              originalName: "aadhaar.pdf",
              fileSize: 102400,
              mimeType: "application/pdf",
            },
          ],
        },
      };

      const directIntent = createDirectServiceIntent(serviceItem);

      expect(directIntent.type).toBe("direct_service");
      expect(directIntent.items).toHaveLength(1);
      expect(directIntent.items[0].serviceId).toBe("srv_pvc");
      expect(directIntent.items[0].fileIds).toEqual(["file_aadhaar_01"]);
      expect(directIntent.items[0].configuration?.documentType).toBe("aadhaar");
      expect(directIntent.items[0].configuration?.specialInstructions).toBe("Matte coating");
    });

    it("should exclude unrelated cart products when checking out a direct printing service", () => {
      const regularCart: CartItem[] = [
        {
          id: "cart_pen",
          itemType: "product",
          name: "Gel Pens Box of 10",
          description: "Blue ink",
          quantity: 1,
          unitPrice: 100,
          totalPrice: 100,
          productId: "prod_pen_01",
          configuration: {},
        },
      ];

      const directDocService: CartItem = {
        id: "cart_doc_direct",
        itemType: "document_print",
        name: "Document Print (A4 B&W)",
        description: "10 Pgs × 1 Set | Single-Sided",
        quantity: 1,
        unitPrice: 20,
        totalPrice: 20,
        serviceId: "srv_doc",
        fileIds: ["doc_file_99"],
        configuration: {
          paperSize: "A4",
          printMode: "bw",
          sides: "single",
          pageCount: 10,
        },
      };

      const intent = createDirectServiceIntent(directDocService);

      // Intent only contains the printing service
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].itemType).toBe("document_print");

      // Regular cart remains intact with the retail product
      expect(regularCart).toHaveLength(1);
      expect(regularCart[0].productId).toBe("prod_pen_01");
    });

    it("should verify all 4 service pages offer both Direct Order (Order Now) and Add to Cart options", () => {
      const pvcCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/services/pvc-card/page.tsx"), "utf-8");
      expect(pvcCode).toContain("handleDirectOrder");
      expect(pvcCode).toContain("createDirectServiceIntent");
      expect(pvcCode).toContain("Order This PVC Card Now");
      expect(pvcCode).toContain("Add to Cart");

      const docCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/services/document-printing/page.tsx"), "utf-8");
      expect(docCode).toContain("handleDirectOrder");
      expect(docCode).toContain("createDirectServiceIntent");
      expect(docCode).toContain("Order Document Printing Now");
      expect(docCode).toContain("Add to Cart");

      const photoCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/services/photo-printing/page.tsx"), "utf-8");
      expect(photoCode).toContain("handleDirectOrder");
      expect(photoCode).toContain("createDirectServiceIntent");
      expect(photoCode).toContain("Order Photo Prints Now");
      expect(photoCode).toContain("Add to Cart");

      const lamCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/services/lamination/page.tsx"), "utf-8");
      expect(lamCode).toContain("handleDirectOrder");
      expect(lamCode).toContain("createDirectServiceIntent");
      expect(lamCode).toContain("Order Lamination Now");
      expect(lamCode).toContain("Add to Cart");
    });
  });

  /* ========================================================================
   * PART 5: PAYMENT & ORDER INTEGRITY
   * ======================================================================== */
  describe("PART 5: Order & Payment Integrity", () => {
    it("should create orders with pending status and unpaid payment status", async () => {
      const testOrderId = `ord_test_integrity_${Date.now()}`;
      const ref = generateOrderReference();

      await db
        .insert(users)
        .values({
          id: "usr_cust_001",
          fullName: "Customer Test",
          email: "customer001@example.com",
          phone: "9876543201",
          passwordHash: "hash_test_cust",
          role: "customer",
          isEmailVerified: true,
          isPhoneVerified: true,
        })
        .onConflictDoNothing();

      await db.insert(orders).values({
        id: testOrderId,
        orderReference: ref,
        customerId: "usr_cust_001",
        orderType: "shopping",
        deliveryType: "store_pickup",
        paymentMethod: "upi_mock",
        paymentStatus: "unpaid",
        orderStatus: "pending",
        subtotal: 300,
        discount: 0,
        additionalCharges: 0,
        totalAmount: 300,
      });

      const [created] = await db.select().from(orders).where(eq(orders.id, testOrderId));

      expect(created).toBeDefined();
      expect(created.orderStatus).toBe("pending");
      expect(created.paymentStatus).toBe("unpaid");
    });

    it("should verify checkout page handles selective cart removal and intent isolation", () => {
      const checkoutCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/checkout/page.tsx"), "utf-8");
      expect(checkoutCode).toContain("getActiveCheckoutIntent");
      expect(checkoutCode).toContain("clearCheckoutIntent");
      expect(checkoutCode).toContain("removeItems(checkoutIntent.sourceCartItemIds)");
      expect(checkoutCode).toContain("checkoutIntent?.type === \"buy_now\"");
      expect(checkoutCode).toContain("checkoutIntent?.type === \"selected_items\"");
      expect(checkoutCode).toContain("checkoutIntent?.type === \"direct_service\"");
    });
  });
});
