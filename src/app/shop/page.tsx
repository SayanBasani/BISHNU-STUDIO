"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatINR } from "@/lib/utils";
import {
  ShoppingBag,
  Search,
  Check,
  AlertTriangle,
  ArrowRight,
  Filter,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountedPrice: number | null;
  stockQuantity: number;
  isAvailable: boolean;
  sku: string;
  categoryName: string;
  categorySlug: string;
  primaryImage: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function ShopPage() {
  const { addItem, isInCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [addedId, setAddedId] = useState<string | null>(null);
  const [addedInfo, setAddedInfo] = useState<Record<string, { alreadyInCart: boolean; currentQuantity: number }>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/products", window.location.origin);
      if (selectedCategory !== "all") {
        url.searchParams.set("category", selectedCategory);
      }
      if (search) {
        url.searchParams.set("search", search);
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        if (categories.length === 0) {
          setCategories(data.categories);
        }
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleAddToCart = (product: Product) => {
    if (addingId === product.id || product.stockQuantity <= 0) return;
    setAddingId(product.id);

    const effectivePrice = product.discountedPrice || product.price;
    const result = addItem({
      id: `cart_prod_${product.id}`,
      itemType: "product",
      name: product.name,
      description: `SKU: ${product.sku} | Category: ${product.categoryName}`,
      quantity: 1,
      unitPrice: effectivePrice,
      totalPrice: effectivePrice,
      productId: product.id,
      configuration: {},
    }, { maxStock: product.stockQuantity });

    setAddedId(product.id);
    setAddedInfo((prev) => ({
      ...prev,
      [product.id]: {
        alreadyInCart: result.alreadyInCart,
        currentQuantity: result.currentQuantity,
      },
    }));

    setTimeout(() => {
      setAddingId(null);
    }, 300);

    setTimeout(() => {
      setAddedId((curr) => (curr === product.id ? null : curr));
      setAddedInfo((prev) => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
    }, 2200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Bio */}
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Stationery & Shop Supplies
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl">
          Browse authentic office paper, student notebooks, computer accessories, desk binders, and daily printing supplies available directly at Bishnu Studio.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search by product name, SKU or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </form>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.slug
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 animate-pulse"
            >
              <div className="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            No products found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Try adjusting your search query or selecting a different category.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
            }}
            className="px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const isOutOfStock = product.stockQuantity <= 0;
            const isLowStock = product.stockQuantity > 0 && product.stockQuantity < 10;
            const isJustAdded = addedId === product.id;

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <Link href={`/shop/${product.id}`} className="block relative aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={product.primaryImage}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                    {product.discountedPrice && (
                      <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        SAVE {Math.round(((product.price - product.discountedPrice) / product.price) * 100)}%
                      </span>
                    )}
                  </Link>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono">{product.sku}</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{product.categoryName}</span>
                    </div>

                    <Link href={`/shop/${product.id}`}>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 transition">
                        {product.name}
                      </h3>
                    </Link>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="flex items-baseline gap-2 pt-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatINR(product.discountedPrice || product.price)}
                      </span>
                      {product.discountedPrice && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatINR(product.price)}
                        </span>
                      )}
                    </div>

                    {/* Stock Alert Badge */}
                    <div className="pt-1">
                      {isOutOfStock ? (
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Only {product.stockQuantity} left
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          In Stock ({product.stockQuantity} available)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  {isOutOfStock ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    >
                      Out of Stock
                    </button>
                  ) : isJustAdded ? (
                    <div className="w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 bg-emerald-600 text-white shadow-sm transition">
                      <Check className="w-4 h-4" />
                      {addedInfo[product.id]?.alreadyInCart ? "Already in your cart" : "Added to Cart!"}
                    </div>
                  ) : isInCart({ itemType: "product", productId: product.id, configuration: {} }) ? (
                    <Link
                      href="/cart"
                      className="w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shadow-xs"
                    >
                      <Check className="w-4 h-4" /> In Cart · View Cart
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={addingId === product.id}
                      onClick={() => handleAddToCart(product)}
                      className="w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                    >
                      <ShoppingBag className="w-4 h-4" /> Add to Cart
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
