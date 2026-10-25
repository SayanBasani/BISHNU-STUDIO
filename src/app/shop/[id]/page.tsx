"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import { createBuyNowIntent, saveCheckoutIntent } from "@/lib/checkout";
import {
  ShoppingBag,
  ArrowLeft,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw,
  AlertTriangle,
  Minus,
  Plus,
  Star,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Zap,
} from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { addItem, getItemInCart, updateQuantity } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<{
    alreadyInCart?: boolean;
    currentQuantity?: number;
    message?: string;
  } | null>(null);

  // Reviews state
  const [reviewsData, setReviewsData] = useState<any>({
    reviews: [],
    summary: { averageRating: 0, totalReviews: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
    isVerifiedPurchase: false,
    userReview: null,
    canReview: true,
  });
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchReviews();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      if (data.success) {
        setProduct(data.product);
      }
    } catch (e) {
      console.error("Failed to load product:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const res = await fetch(`/api/products/${id}/reviews`);
      const data = await res.json();
      if (data.success) {
        setReviewsData(data);
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Prepare images array
  const allImages: string[] =
    product && product.images && product.images.length > 0
      ? product.images.map((img: any) => (typeof img === "string" ? img : img.imageUrl))
      : product?.primaryImage
      ? [product.primaryImage]
      : ["/placeholder-product.png"];

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation & body scroll lock for lightbox
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") handlePrevImage();
      if (e.key === "ArrowRight") handleNextImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen, allImages.length]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 animate-pulse space-y-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Product Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          The requested product item might have been archived or removed from the catalogue.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Shop
        </Link>
      </div>
    );
  }

  const effectivePrice = product.discountedPrice || product.price;
  const isOutOfStock = product.stockQuantity <= 0;

  const currentImage = allImages[activeImageIndex] || allImages[0];

  const handleAddToCart = () => {
    if (adding || isOutOfStock) return;
    setAdding(true);

    const cartItem = getItemInCart({ itemType: "product", productId: product.id, configuration: {} });

    if (cartItem) {
      if (quantity !== cartItem.quantity) {
        // Customer explicitly adjusted the quantity selector — update cart line quantity
        updateQuantity(cartItem.id, quantity, { maxStock: product.stockQuantity });
        setCartFeedback({
          alreadyInCart: true,
          currentQuantity: quantity,
          message: `Cart quantity updated to ${quantity}!`,
        });
      } else {
        // Already in cart with exact quantity — inform without arbitrary increments
        setCartFeedback({
          alreadyInCart: true,
          currentQuantity: cartItem.quantity,
          message: `Already in your cart (${cartItem.quantity} ${cartItem.quantity === 1 ? "unit" : "units"})`,
        });
      }
    } else {
      // Add fresh line with chosen quantity
      const result = addItem({
        id: `cart_prod_${product.id}`,
        itemType: "product",
        name: product.name,
        description: `SKU: ${product.sku} | Category: ${product.categoryName}`,
        quantity,
        unitPrice: effectivePrice,
        totalPrice: effectivePrice * quantity,
        productId: product.id,
        configuration: {},
      }, { maxStock: product.stockQuantity });

      setCartFeedback({
        alreadyInCart: false,
        currentQuantity: result.currentQuantity,
        message: `Added ${result.currentQuantity} ${result.currentQuantity === 1 ? "unit" : "units"} to Cart!`,
      });
    }

    setAdded(true);
    setTimeout(() => setAdding(false), 300);
    setTimeout(() => {
      setAdded(false);
      setCartFeedback(null);
    }, 2500);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    const intent = createBuyNowIntent(product, quantity, {});
    saveCheckoutIntent(intent);
    router.push("/checkout?intent=buy_now");
  };

  const { reviews = [], summary = {}, isVerifiedPurchase = false, canReview = true, userBlocked = false } = reviewsData;
  const avgRating = summary.averageRating || 0;
  const totalReviews = summary.totalReviews || 0;
  const dist = summary.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
          Home
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-blue-600 dark:hover:text-blue-400">
          Shop
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs">
          {product.name}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Product Images Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative h-[380px] sm:h-[450px] lg:h-[480px] w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-center overflow-hidden shadow-sm group transition-all">
            <img
              src={currentImage}
              alt={product.name}
              className="max-h-full max-w-full object-contain transition-all duration-300 select-none"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=600&q=80";
              }}
            />

            {/* Discount Badge */}
            {product.discountedPrice && (
              <span className="absolute top-3 left-3 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-md">
                SAVE {Math.round(((product.price - product.discountedPrice) / product.price) * 100)}%
              </span>
            )}

            {/* Image Counter Pill */}
            {allImages.length > 1 && (
              <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {activeImageIndex + 1} / {allImages.length}
              </span>
            )}

            {/* Fullscreen Lightbox Button */}
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md opacity-80 group-hover:opacity-100 transition shadow-md"
              title="View full-size photo"
              aria-label="View fullscreen image"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Prev/Next Navigation Arrows */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-white dark:hover:bg-slate-900 focus:opacity-100"
                  title="Previous image"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-white dark:hover:bg-slate-900 focus:opacity-100"
                  title="Next image"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Carousel Strip */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Product thumbnails">
              {allImages.map((imgUrl: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  role="tab"
                  aria-selected={activeImageIndex === idx}
                  aria-label={`View product image ${idx + 1}`}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition shrink-0 p-1 bg-white dark:bg-slate-800 flex items-center justify-center ${
                    activeImageIndex === idx
                      ? "border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/30 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Details & Actions */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                {product.categoryName}
              </span>
              <span className="text-xs font-mono text-slate-400">
                SKU: {product.sku}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {product.name}
            </h1>

            {/* Rating Stars Summary in Header */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 dark:text-slate-700"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {avgRating > 0 ? avgRating.toFixed(1) : "New"}
              </span>
              <span className="text-xs text-slate-400">
                ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
              </span>
            </div>
          </div>

          {/* Pricing Display */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {formatINR(effectivePrice)}
            </span>
            {product.discountedPrice && (
              <>
                <span className="text-base text-slate-400 line-through font-mono">
                  {formatINR(product.price)}
                </span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded">
                  SAVE {Math.round(((product.price - product.discountedPrice) / product.price) * 100)}%
                </span>
              </>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
              Inclusive of all taxes
            </span>
          </div>

          {/* Inventory Status */}
          <div>
            {isOutOfStock ? (
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Currently Out of Stock
              </p>
            ) : product.stockQuantity < 10 ? (
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Only {product.stockQuantity} units left in shop stock!
              </p>
            ) : (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> In Stock & ready for collection or delivery
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Description</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* Quantity Selector & Add Button */}
          {!isOutOfStock && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quantity:</span>
                <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                    title="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={product.stockQuantity}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val)) setQuantity(1);
                      else setQuantity(Math.max(1, Math.min(product.stockQuantity, val)));
                    }}
                    className="w-14 text-center text-sm font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                    disabled={quantity >= product.stockQuantity}
                    className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                    title="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Total: <strong className="text-slate-900 dark:text-white font-mono">{formatINR(effectivePrice * quantity)}</strong>
                </span>
              </div>

              {/* Action Buttons: Add to Cart + Buy Now + View Cart */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  disabled={adding || isOutOfStock}
                  onClick={handleAddToCart}
                  className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition ${
                    added
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4" />
                      {cartFeedback?.message || "Updated!"}
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" /> Add to Cart
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={handleBuyNow}
                  className="flex-1 py-3.5 px-5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Zap className="w-4 h-4" /> Buy Now
                </button>

                <Link
                  href="/cart"
                  className="px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-sm text-slate-700 dark:text-slate-200 transition text-center"
                >
                  View Cart
                </Link>
              </div>
            </div>
          )}

          {/* Shop Guarantees */}
          <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Same-day store pickup</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>100% genuine office supplies</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery fullscreen view"
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-50"
            title="Close viewer (Esc)"
            aria-label="Close fullscreen view"
          >
            <X className="w-6 h-6" />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-50 cursor-pointer"
                title="Previous image"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-50 cursor-pointer"
                title="Next image"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl max-h-[85vh] flex flex-col items-center cursor-default select-none"
          >
            <img
              src={currentImage}
              alt={product.name}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            {allImages.length > 1 && (
              <span className="text-white/80 text-xs font-semibold mt-3 bg-black/40 px-3 py-1 rounded-full">
                {activeImageIndex + 1} of {allImages.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Verified Customer Reviews Section */}
      <section className="pt-10 border-t border-slate-200 dark:border-slate-800 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" /> Customer Ratings & Reviews
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real customer feedback with verified purchase status directly from Bishnu Studio orders
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Summary Breakdown Box */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            <div className="text-center space-y-2">
              <div className="text-5xl font-extrabold text-slate-900 dark:text-white font-mono">
                {avgRating > 0 ? avgRating.toFixed(1) : "0.0"}
              </div>
              <div className="flex items-center justify-center text-amber-400 gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= Math.round(avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 dark:text-slate-700"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Based on {totalReviews} {totalReviews === 1 ? "review" : "customer reviews"}
              </p>
            </div>

            {/* Distribution Bars */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              {[5, 4, 3, 2, 1].map((starNum) => {
                const count = dist[starNum] || 0;
                const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                return (
                  <div key={starNum} className="flex items-center gap-2">
                    <span className="w-6 text-slate-600 dark:text-slate-400 font-medium">{starNum} ★</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <span className="w-8 text-right font-mono text-slate-400 text-[11px]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews List & Verified Review Information */}
          <div className="lg:col-span-8 space-y-6">
            {/* Authentic Reviews Verification Policy Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Verified Customer Feedback Policy
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                To guarantee genuine ratings and prevent spam, customer reviews on Bishnu Studio can only be submitted after your order containing this product has been successfully completed, collected, or delivered.
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Already purchased and received this product?
                </span>
                <Link
                  href="/account/orders"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Write Review in My Orders
                </Link>
              </div>
            </div>

            {/* Published Customer Reviews Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Customer Reviews ({totalReviews})
                </h3>
                {totalReviews > 0 && (
                  <Link
                    href={`/shop/${product.id}/reviews`}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    View All {totalReviews} Reviews &rarr;
                  </Link>
                )}
              </div>

              {reviewsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No customer reviews yet
                  </p>
                  <p className="text-xs text-slate-400">
                    Be the first customer to share feedback after receiving your order!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.slice(0, 3).map((rev: any) => (
                    <div
                      key={rev.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {rev.customerAvatar ? (
                            <img
                              src={rev.customerAvatar}
                              alt={rev.customerName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                              {rev.customerName?.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-xs block">
                              {rev.customerName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(rev.createdAt)}
                            </span>
                          </div>
                        </div>

                        {rev.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Verified Purchase
                          </span>
                        )}
                      </div>

                      <div className="flex items-center text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rev.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200 dark:text-slate-800"
                            }`}
                          />
                        ))}
                      </div>

                      {rev.reviewTitle && (
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                          {rev.reviewTitle}
                        </h4>
                      )}

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {rev.reviewText}
                      </p>
                    </div>
                  ))}

                  {totalReviews > 3 && (
                    <div className="text-center pt-2">
                      <Link
                        href={`/shop/${product.id}/reviews`}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs inline-flex items-center gap-1.5 transition"
                      >
                        See All {totalReviews} Reviews &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
