"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { formatINR } from "@/lib/utils";
import { createSelectedItemsIntent, saveCheckoutIntent } from "@/lib/checkout";
import {
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  CreditCard,
  FileText,
  Layers,
  Camera,
  Store,
  Truck,
  ShieldCheck,
  CheckSquare,
  Square,
  Check,
} from "lucide-react";

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, cartSubtotal } = useCart();

  // Selection state for selective checkout
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Initialize all items as selected on mount or when items change
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const item of items) {
        // Keep previous selection if it existed, otherwise default to selected
        if (prev.size === 0 || prev.has(item.id)) {
          next.add(item.id);
        }
      }
      // If none selected but cart has items, select all
      if (next.size === 0 && items.length > 0 && prev.size === 0) {
        items.forEach((i) => next.add(i.id));
      }
      return next;
    });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Cart is Empty</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
            You don't have any items or printing requests in your cart yet. Explore our shop or print services to get started.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/services/pvc-card"
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm"
          >
            PVC Card Printing
          </Link>
          <Link
            href="/services/document-printing"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-sm"
          >
            Document Printing
          </Link>
          <Link
            href="/shop"
            className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-slate-800 text-white font-semibold text-sm hover:bg-gray-800 shadow-sm"
          >
            Browse Stationery Shop
          </Link>
        </div>
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const selectedSubtotal = Math.round(
    selectedItems.reduce((acc, i) => acc + i.totalPrice, 0) * 100
  ) / 100;
  const selectedUnitsCount = selectedItems.reduce((acc, i) => acc + i.quantity, 0);

  const handleProceedToSelectedCheckout = () => {
    if (selectedItems.length === 0) return;
    const intent = createSelectedItemsIntent(selectedItems);
    saveCheckoutIntent(intent);
    router.push("/checkout?intent=selected");
  };

  const handleCheckoutAll = () => {
    const intent = createSelectedItemsIntent(items);
    saveCheckoutIntent(intent);
    router.push("/checkout?intent=selected");
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "pvc_card":
        return <CreditCard className="w-5 h-5 text-blue-600" />;
      case "document_print":
        return <FileText className="w-5 h-5 text-emerald-600" />;
      case "lamination":
        return <Layers className="w-5 h-5 text-purple-600" />;
      case "photo_print":
        return <Camera className="w-5 h-5 text-rose-600" />;
      default:
        return <ShoppingBag className="w-5 h-5 text-gray-700 dark:text-gray-300" />;
    }
  };

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Select items you want to purchase right now. Unselected items remain safe in your cart.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
          >
            Clear Entire Cart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Items List */}
        <div className="lg:col-span-8 space-y-4">
          {/* Master Select All / Deselect All Controls */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                aria-label="Select all cart items"
              />
              <span>
                {isAllSelected
                  ? `All items selected (${items.length}/${items.length})`
                  : `Select All (${selectedIds.size} of ${items.length} selected)`}
              </span>
            </label>

            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isSelected
                    ? "border-blue-500/50 dark:border-blue-500/40 ring-1 ring-blue-500/20"
                    : "border-gray-200 dark:border-slate-800 opacity-80"
                }`}
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Selection Checkbox */}
                  <div className="pt-2 sm:pt-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                      aria-label={`Select ${item.name}`}
                    />
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    {getItemIcon(item.itemType)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {item.name}
                      </h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                        {item.itemType.replace(/_/g, " ")}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 pt-1">
                      Rate: {formatINR(item.unitPrice)}
                    </div>
                  </div>
                </div>

                {/* Explicit Quantity Controls & Delete */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800">
                  <div className="flex items-center border border-gray-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center text-xs font-bold text-gray-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                      title="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <p className="text-base font-extrabold text-gray-900 dark:text-white">
                      {formatINR(item.totalPrice)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary & Checkout Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3">
              Order Summary
            </h3>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              {/* Selected Items Subtotal */}
              <div className="flex justify-between items-center">
                <span>Selected Items Subtotal:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatINR(selectedSubtotal)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <span>Selected Lines &amp; Units:</span>
                <span>
                  {selectedItems.length} {selectedItems.length === 1 ? "line" : "lines"} ({selectedUnitsCount} {selectedUnitsCount === 1 ? "unit" : "units"})
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                <span>Full Cart Total Value:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatINR(cartSubtotal)}
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span>Store Pickup:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Doorstep Delivery:</span>
                <span className="text-gray-500 dark:text-gray-400">
                  Calculated at Checkout (Free on orders ₹500+)
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-3 flex items-baseline justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-base">
                Selected Checkout Subtotal:
              </span>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                  {formatINR(selectedSubtotal)}
                </span>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Taxes included</p>
              </div>
            </div>

            {/* Primary Checkout of Selected Items */}
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={handleProceedToSelectedCheckout}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition ${
                selectedItems.length === 0
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25"
              }`}
            >
              Proceed to Checkout ({selectedItems.length} selected) <ArrowRight className="w-4 h-4" />
            </button>

            {selectedItems.length === 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400 text-center font-medium">
                Please select at least one item to proceed to checkout.
              </p>
            )}

            {/* Convenience button to checkout all items if not all selected */}
            {!isAllSelected && items.length > 0 && (
              <button
                type="button"
                onClick={handleCheckoutAll}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-center"
              >
                Checkout All Items ({items.length} items · {formatINR(cartSubtotal)})
              </button>
            )}
          </div>

          {/* Guarantees */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Counter Collection at Bishnu Studio</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Unselected items stay safely in your cart. You can purchase them whenever you're ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
