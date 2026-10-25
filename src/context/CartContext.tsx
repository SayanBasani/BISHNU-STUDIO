"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { CartItem } from "@/types";

export interface AddItemOptions {
  maxStock?: number;
}

export interface AddItemResult {
  added: boolean;
  alreadyInCart: boolean;
  currentQuantity: number;
  updatedQuantity: number; // for backward compatibility
  wasMerged: boolean;
}

export type CartItemDescriptor = {
  itemType: string;
  productId?: string;
  serviceId?: string;
  configuration?: Record<string, any>;
  fileIds?: string[];
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem, options?: AddItemOptions) => AddItemResult;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  updateQuantity: (id: string, quantity: number, options?: AddItemOptions) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  isInCart: (descriptorOrKey: CartItemDescriptor | string) => boolean;
  getItemQuantity: (descriptorOrKey: CartItemDescriptor | string) => number;
  getItemInCart: (descriptorOrKey: CartItemDescriptor | string) => CartItem | undefined;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "bishnu_cart_v1";

/**
 * Generate a deterministic, stable line identity for cart items.
 * Distinguishes different products and different variant/configuration options,
 * while ensuring identical products with the same options match a single line.
 */
export function getCartLineKey(item: CartItemDescriptor): string {
  if (item.itemType === "product" && item.productId) {
    const config = item.configuration && Object.keys(item.configuration).length > 0
      ? item.configuration
      : {};
    const sortedKeys = Object.keys(config).sort();
    const configStr = sortedKeys.length > 0 ? JSON.stringify(config, sortedKeys) : "";
    return `prod_${item.productId}${configStr ? `_${configStr}` : ""}`;
  }

  // Print Services: distinguish by serviceId, configuration parameters and uploaded files
  const config = item.configuration ? { ...item.configuration } : {};
  delete (config as any)._timestamp;
  delete (config as any).uploadedFiles; // Exclude transient previews
  const sortedKeys = Object.keys(config).sort();
  const configStr = JSON.stringify(config, sortedKeys);
  const filesStr = (item.fileIds || []).slice().sort().join(",");
  return `srv_${item.itemType}_${item.serviceId || ""}_${configStr}_${filesStr}`;
}

/**
 * Cleanly merges duplicate matching items in any raw cart array (e.g. from local storage)
 */
export function deduplicateCartItems(rawItems: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();

  for (const item of rawItems) {
    const key = getCartLineKey(item);
    const existing = map.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      existing.totalPrice = Math.round(existing.unitPrice * existing.quantity * 100) / 100;
    } else {
      map.set(key, {
        ...item,
        id: item.id || `cart_${key}`,
        quantity: Math.max(1, item.quantity),
        totalPrice: Math.round(item.unitPrice * Math.max(1, item.quantity) * 100) / 100,
      });
    }
  }

  return Array.from(map.values());
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load and auto-deduplicate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const deduplicated = deduplicateCartItems(parsed);
          setItems(deduplicated);
        }
      }
    } catch (e) {
      console.error("Failed to load cart from storage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error("Failed to persist cart:", e);
      }
    }
  }, [items, isLoaded]);

  /**
   * Helper to resolve descriptor or key to standard string key
   */
  const resolveKey = (descriptorOrKey: CartItemDescriptor | string): string => {
    return typeof descriptorOrKey === "string"
      ? descriptorOrKey
      : getCartLineKey(descriptorOrKey);
  };

  const isInCart = (descriptorOrKey: CartItemDescriptor | string): boolean => {
    const targetKey = resolveKey(descriptorOrKey);
    return items.some((i) => getCartLineKey(i) === targetKey);
  };

  const getItemQuantity = (descriptorOrKey: CartItemDescriptor | string): number => {
    const targetKey = resolveKey(descriptorOrKey);
    const item = items.find((i) => getCartLineKey(i) === targetKey);
    return item ? item.quantity : 0;
  };

  const getItemInCart = (descriptorOrKey: CartItemDescriptor | string): CartItem | undefined => {
    const targetKey = resolveKey(descriptorOrKey);
    return items.find((i) => getCartLineKey(i) === targetKey);
  };

  /**
   * Adds an item to the cart.
   * STRICT RULE: If a line with matching product/options already exists in the cart,
   * repeated Add to Cart clicks do NOT automatically increment the quantity!
   * It preserves the current quantity and informs the caller that it's already in the cart.
   */
  const addItem = (newItem: CartItem, options?: AddItemOptions): AddItemResult => {
    const targetKey = getCartLineKey(newItem);
    let added = false;
    let alreadyInCart = false;
    let finalQty = newItem.quantity;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => getCartLineKey(i) === targetKey);

      if (existingIndex > -1) {
        // Already in cart: do NOT increment automatically
        alreadyInCart = true;
        finalQty = prev[existingIndex].quantity;
        return prev;
      }

      // Fresh item being added
      added = true;
      const stableId = newItem.id && !newItem.id.includes("Date.now")
        ? newItem.id
        : `cart_${targetKey}`;

      const validQuantity = Math.max(
        1,
        options?.maxStock !== undefined
          ? Math.min(newItem.quantity, options.maxStock)
          : newItem.quantity
      );

      finalQty = validQuantity;

      return [
        ...prev,
        {
          ...newItem,
          id: stableId,
          quantity: validQuantity,
          totalPrice: Math.round(newItem.unitPrice * validQuantity * 100) / 100,
        },
      ];
    });

    return {
      added,
      alreadyInCart,
      currentQuantity: finalQty,
      updatedQuantity: finalQty,
      wasMerged: false,
    };
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  /**
   * Removes specific items by ID (e.g. only purchased items from a selected checkout),
   * strictly preserving unselected cart items.
   */
  const removeItems = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const toRemove = new Set(ids);
    setItems((prev) => prev.filter((i) => !toRemove.has(i.id)));
  };

  /**
   * Explicit quantity control — increments, decrements, or sets quantity directly
   */
  const updateQuantity = (id: string, quantity: number, options?: AddItemOptions) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }

    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const effectiveQuantity = options?.maxStock !== undefined
          ? Math.min(quantity, options.maxStock)
          : quantity;

        return {
          ...i,
          quantity: effectiveQuantity,
          totalPrice: Math.round(i.unitPrice * effectiveQuantity * 100) / 100,
        };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        removeItems,
        updateQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        isInCart,
        getItemQuantity,
        getItemInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
