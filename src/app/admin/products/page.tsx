"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatINR } from "@/lib/utils";
import {
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Star,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";

interface ProductImage {
  id?: string;
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

function AdminProductsContent() {
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get("edit") || searchParams.get("id");
  const [hasProcessedInitialEdit, setHasProcessedInitialEdit] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Form Fields
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  // Multiple Images Management
  const [images, setImages] = useState<ProductImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products?availableOnly=false");
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        setCategories(data.categories);
        if (data.categories.length > 0 && !categoryId) {
          setCategoryId(data.categories[0].id);
        }

        if (editIdParam && !hasProcessedInitialEdit) {
          setHasProcessedInitialEdit(true);
          const target = (data.products || []).find((p: any) => p.id === editIdParam);
          if (target) {
            handleOpenEdit(target);
          } else {
            setError(`Product ID "${editIdParam}" not found in catalog (it may have been deleted or archived).`);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load products:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setName("");
    setSku(`BS-SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setDescription("");
    setPrice("");
    setDiscountedPrice("");
    setStockQuantity("50");
    setImages([
      {
        imageUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=600&q=80",
        isPrimary: true,
        sortOrder: 0,
      },
    ]);
    setNewImageUrl("");
    setIsAvailable(true);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: any) => {
    setEditingProduct(prod);
    setCategoryId(prod.categoryId);
    setName(prod.name);
    setSku(prod.sku);
    setDescription(prod.description);
    setPrice(prod.price.toString());
    setDiscountedPrice(prod.discountedPrice ? prod.discountedPrice.toString() : "");
    setStockQuantity(prod.stockQuantity.toString());

    // Populate images list
    if (prod.imageList && prod.imageList.length > 0) {
      setImages(
        prod.imageList.map((img: any, idx: number) => ({
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder ?? idx,
        }))
      );
    } else if (prod.images && prod.images.length > 0) {
      setImages(
        prod.images.map((url: string, idx: number) => ({
          imageUrl: url,
          isPrimary: idx === 0,
          sortOrder: idx,
        }))
      );
    } else if (prod.primaryImage) {
      setImages([{ imageUrl: prod.primaryImage, isPrimary: true, sortOrder: 0 }]);
    } else {
      setImages([]);
    }

    setNewImageUrl("");
    setIsAvailable(prod.isAvailable);
    setError(null);
    setIsModalOpen(true);
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    const isFirst = images.length === 0;
    setImages([
      ...images,
      {
        imageUrl: newImageUrl.trim(),
        isPrimary: isFirst,
        sortOrder: images.length,
      },
    ]);
    setNewImageUrl("");
  };

  const handleSetPrimary = (index: number) => {
    setImages(
      images.map((img, idx) => ({
        ...img,
        isPrimary: idx === index,
      }))
    );
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // reassign sortOrder
    setImages(
      updated.map((img, idx) => ({
        ...img,
        sortOrder: idx,
      }))
    );
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, idx) => idx !== index);
    if (images[index].isPrimary && updated.length > 0) {
      updated[0].isPrimary = true;
    }
    setImages(
      updated.map((img, idx) => ({
        ...img,
        sortOrder: idx,
      }))
    );
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (images.length === 0) {
      setError("Please add at least one product image.");
      return;
    }

    setSaving(true);

    try {
      const payloadImages = images.map((img, idx) => ({
        imageUrl: img.imageUrl,
        isPrimary: img.isPrimary,
        sortOrder: idx,
      }));

      if (editingProduct) {
        // Update product
        const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            price: parseFloat(price),
            discountedPrice: discountedPrice ? parseFloat(discountedPrice) : null,
            stockQuantity: parseInt(stockQuantity, 10),
            isAvailable,
            images: payloadImages,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update product");
      } else {
        // Create product
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId,
            name,
            sku,
            description,
            price: parseFloat(price),
            discountedPrice: discountedPrice ? parseFloat(discountedPrice) : undefined,
            stockQuantity: parseInt(stockQuantity, 10),
            images: payloadImages,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create product");
      }

      setIsModalOpen(false);
      await fetchProducts();
    } catch (err: any) {
      setError(err?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!confirm(`Are you sure you want to permanently delete product "${prodName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.categoryName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Product Catalogue & Multi-Image Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage store merchandise, inventory stock, multi-image galleries, and prices
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add New Product
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search products by name, SKU or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Primary Image</th>
                  <th className="py-3 px-4">Name & SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Inventory</th>
                  <th className="py-3 px-4">Gallery</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredProducts.map((p) => {
                  const imageCount = p.imageList?.length || p.images?.length || 1;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <img
                          src={p.primaryImage}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                        />
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {p.sku}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {p.categoryName}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono">
                        {formatINR(p.discountedPrice || p.price)}
                        {p.discountedPrice && (
                          <span className="text-[10px] text-slate-400 line-through block font-normal">
                            {formatINR(p.price)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.stockQuantity <= 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">Out of stock</span>
                        ) : p.stockQuantity < 10 ? (
                          <span className="text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {p.stockQuantity} left
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                            {p.stockQuantity} in stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <ImageIcon className="w-3 h-3" /> {imageCount} {imageCount === 1 ? "photo" : "photos"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.isAvailable
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {p.isAvailable ? "Available" : "Hidden"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition"
                          title="Edit product & gallery"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingProduct ? "Edit Product & Image Gallery" : "Add New Product"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {!editingProduct && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {!editingProduct ? (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unique SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SKU (Fixed)
                    </label>
                    <p className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono text-slate-600 dark:text-slate-300">
                      {sku}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Regular Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Discounted Price (₹, optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Store Visibility
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={isAvailable}
                      onChange={(e) => setIsAvailable(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Available on store</span>
                  </label>
                </div>
              </div>

              {/* Multi-Image Gallery Manager */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 dark:text-slate-200">
                    Product Image Gallery ({images.length})
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Designate primary cover and reorder photos
                  </span>
                </div>

                {/* Add Image Input */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Paste image URL (e.g. https://images.unsplash.com/...)"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {/* Images List */}
                {images.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-2">
                    No images added yet. Add at least one image URL above.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs gap-3 ${
                          img.isPrimary
                            ? "bg-purple-50/60 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={img.imageUrl}
                            alt={`Image ${idx + 1}`}
                            className="w-10 h-10 object-cover rounded border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div className="truncate">
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate block max-w-xs">
                              {img.imageUrl}
                            </span>
                            {img.isPrimary && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                <Star className="w-3 h-3 fill-purple-600" /> Primary Cover Image
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!img.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(idx)}
                              className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-100 dark:hover:bg-purple-900 transition"
                            >
                              Make Primary
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveImage(idx, "up")}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === images.length - 1}
                            onClick={() => handleMoveImage(idx, "down")}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700"
                            title="Remove Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-60 transition shadow-sm"
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2 font-medium">Loading catalog products...</p>
        </div>
      }
    >
      <AdminProductsContent />
    </Suspense>
  );
}
