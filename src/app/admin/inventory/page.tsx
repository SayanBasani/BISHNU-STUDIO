"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/utils";
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Plus,
  Minus,
  Loader2,
  ExternalLink,
  Package,
} from "lucide-react";

interface ProductStock {
  id: string;
  name: string;
  sku: string;
  price: number;
  discountedPrice?: number | null;
  stockQuantity: number;
  isAvailable: boolean;
  categoryName?: string | null;
  updatedAt: number;
}

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/inventory");
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (productId: string, delta: number) => {
    setUpdatingId(productId);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, delta }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  stockQuantity: data.newStock,
                  isAvailable: data.newStock > 0,
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error("Failed to adjust stock", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSetStock = async (productId: string, newStock: number) => {
    if (isNaN(newStock) || newStock < 0) return;
    setUpdatingId(productId);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, stockQuantity: newStock }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  stockQuantity: data.newStock,
                  isAvailable: data.newStock > 0,
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error("Failed to set stock", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const inStockCount = products.filter((p) => p.stockQuantity >= 10).length;
  const lowStockCount = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity < 10).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  const filteredProducts = products.filter((p) => {
    const searchMatch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.categoryName || "").toLowerCase().includes(search.toLowerCase());

    if (filter === "low") {
      return searchMatch && p.stockQuantity > 0 && p.stockQuantity < 10;
    }
    if (filter === "out") {
      return searchMatch && p.stockQuantity === 0;
    }
    return searchMatch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-600" />
            Inventory Stock Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor real-time warehouse inventory, manage stock replenishments, and address low-stock alerts
          </p>
        </div>

        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition self-start sm:self-auto"
        >
          <Package className="w-4 h-4" /> Manage All Products
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Healthy Stock (&ge; 10 units)
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {inStockCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Low Stock Warnings (&lt; 10 units)
            </span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {lowStockCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Depleted / Out of Stock
            </span>
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
              {outOfStockCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product title, SKU code, or category..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === "all"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setFilter("low")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === "low"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
            }`}
          >
            Low Stock ({lowStockCount})
          </button>
          <button
            onClick={() => setFilter("out")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === "out"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100"
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" />
            <p className="text-xs mt-2">Loading inventory ledger...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Boxes className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No products match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Retail Price</th>
                  <th className="py-3.5 px-4">Stock Level</th>
                  <th className="py-3.5 px-4 text-center">Quick Adjust</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredProducts.map((p) => {
                  const isUpdating = updatingId === p.id;
                  const isLow = p.stockQuantity > 0 && p.stockQuantity < 10;
                  const isOut = p.stockQuantity === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                        {p.sku}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-sm">
                        {p.name}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {p.categoryName || "General"}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {formatINR(p.discountedPrice || p.price)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            defaultValue={p.stockQuantity}
                            key={p.stockQuantity}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== p.stockQuantity) {
                                handleSetStock(p.id, val);
                              }
                            }}
                            className={`w-20 px-2 py-1 rounded-lg border text-center font-mono font-extrabold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none ${
                              isOut
                                ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                                : isLow
                                ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            }`}
                          />
                          <span className="text-slate-400 font-medium">units</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            disabled={isUpdating || p.stockQuantity === 0}
                            onClick={() => handleAdjustStock(p.id, -1)}
                            title="Decrease by 1"
                            className="p-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={isUpdating}
                            onClick={() => handleAdjustStock(p.id, 1)}
                            title="Add 1"
                            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs"
                          >
                            +1
                          </button>
                          <button
                            disabled={isUpdating}
                            onClick={() => handleAdjustStock(p.id, 5)}
                            title="Add 5"
                            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs"
                          >
                            +5
                          </button>
                          <button
                            disabled={isUpdating}
                            onClick={() => handleAdjustStock(p.id, 10)}
                            title="Add 10"
                            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
