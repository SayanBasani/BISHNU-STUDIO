import { CartItem } from "@/types";

export interface CheckoutIntent {
  id: string;
  type: "buy_now" | "selected_items" | "direct_service" | "cart";
  items: CartItem[];
  sourceCartItemIds?: string[];
  createdAt: number;
}

const CHECKOUT_INTENT_KEY = "bishnu_checkout_intent_v1";

/**
 * Persists an active checkout intent into sessionStorage / localStorage
 * so that page refreshes maintain the checkout state without modifying the regular cart.
 */
export function saveCheckoutIntent(intent: CheckoutIntent): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent));
    // Also save in localStorage as backup
    localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent));
  } catch (e) {
    console.error("Failed to save checkout intent:", e);
  }
}

/**
 * Retrieves the currently active checkout intent, or null if expired/unset.
 * Intents older than 2 hours are discarded to prevent stale data.
 */
export function getActiveCheckoutIntent(): CheckoutIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_INTENT_KEY) || localStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutIntent;
    // Expire intents older than 2 hours
    if (Date.now() - parsed.createdAt > 2 * 60 * 60 * 1000) {
      clearCheckoutIntent();
      return null;
    }
    return parsed;
  } catch (e) {
    console.error("Failed to parse checkout intent:", e);
    return null;
  }
}

/**
 * Clears the active checkout intent after an order is placed or when dismissed.
 */
export function clearCheckoutIntent(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    localStorage.removeItem(CHECKOUT_INTENT_KEY);
  } catch (e) {
    console.error("Failed to clear checkout intent:", e);
  }
}

/**
 * Creates a Buy Now intent for a single product and quantity.
 * Does NOT touch or modify the regular shopping cart.
 */
export function createBuyNowIntent(
  product: {
    id: string;
    name: string;
    sku: string;
    categoryName: string;
    price: number;
    discountedPrice?: number | null;
    stockQuantity: number;
  },
  quantity: number,
  configuration: Record<string, any> = {}
): CheckoutIntent {
  const effectivePrice = product.discountedPrice || product.price;
  const validQty = Math.max(1, Math.min(quantity, product.stockQuantity || 1));

  const item: CartItem = {
    id: `buynow_${product.id}_${Date.now()}`,
    itemType: "product",
    name: product.name,
    description: `SKU: ${product.sku} | Category: ${product.categoryName}`,
    quantity: validQty,
    unitPrice: effectivePrice,
    totalPrice: Math.round(effectivePrice * validQty * 100) / 100,
    productId: product.id,
    configuration,
  };

  return {
    id: `intent_bn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: "buy_now",
    items: [item],
    createdAt: Date.now(),
  };
}

/**
 * Creates a Selected Items checkout intent from chosen cart items.
 * Keeps track of source cart item IDs so only purchased items are removed upon order completion.
 */
export function createSelectedItemsIntent(selectedItems: CartItem[]): CheckoutIntent {
  return {
    id: `intent_sel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: "selected_items",
    items: selectedItems,
    sourceCartItemIds: selectedItems.map((i) => i.id),
    createdAt: Date.now(),
  };
}

/**
 * Creates a Direct Service checkout intent for a customized printing request.
 * Excludes any unrelated products in the customer's regular cart.
 */
export function createDirectServiceIntent(serviceItem: CartItem): CheckoutIntent {
  return {
    id: `intent_srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: "direct_service",
    items: [serviceItem],
    createdAt: Date.now(),
  };
}
