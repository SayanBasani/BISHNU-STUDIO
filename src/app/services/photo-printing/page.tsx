"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import FileUpload from "@/components/FileUpload";
import { formatINR } from "@/lib/utils";
import { createDirectServiceIntent, saveCheckoutIntent } from "@/lib/checkout";
import {
  Camera,
  Check,
  ShoppingBag,
  Sparkles,
  Image as ImageIcon,
  HelpCircle,
  Zap,
} from "lucide-react";

export default function PhotoPrintingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [photoSize, setPhotoSize] = useState("passport");
  const [photoFinish, setPhotoFinish] = useState<"glossy" | "matte">("glossy");
  const [copies, setCopies] = useState(1);
  const [instructions, setInstructions] = useState("");

  const [priceData, setPriceData] = useState<{
    unitPrice: number;
    totalPrice: number;
    description: string;
  }>({
    unitPrice: 50,
    totalPrice: 50,
    description: "Passport Size Set (8 Photographs, 35 x 45 mm)",
  });
  const [calculating, setCalculating] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchPrice = async () => {
      setCalculating(true);
      try {
        const res = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceType: "photo_print",
            payload: {
              photoSize,
              photoFinish,
              imageCount: 1,
              copiesPerImage: copies,
            },
          }),
        });
        const data = await res.json();
        if (data.success && !isCancelled) {
          setPriceData({
            unitPrice: data.unitPrice,
            totalPrice: data.totalPrice,
            description: data.breakdown.description,
          });
        }
      } catch (err) {
        console.error("Photo price calculate error:", err);
      } finally {
        if (!isCancelled) setCalculating(false);
      }
    };

    fetchPrice();
    return () => {
      isCancelled = true;
    };
  }, [photoSize, photoFinish, copies]);

  const validateInput = (): boolean => {
    setError(null);
    if (!user) {
      setError("Please log in or register before submitting a photo printing order.");
      return false;
    }
    if (!uploadedFile) {
      setError("Please upload your portrait photograph.");
      return false;
    }
    return true;
  };

  const buildServiceItem = () => {
    return {
      id: `cart_photo_${Date.now()}`,
      itemType: "photo_print" as const,
      name: `Photo Print - ${priceData.description}`,
      description: `${copies} ${copies === 1 ? "Print/Set" : "Prints/Sets"} (${
        photoFinish === "matte" ? "Matte Silk" : "High Gloss"
      }) | File: ${uploadedFile.originalFilename}`,
      quantity: copies,
      unitPrice: priceData.unitPrice,
      totalPrice: priceData.totalPrice,
      serviceId: "srv_photo",
      fileIds: [uploadedFile.fileId],
      configuration: {
        photoSize,
        photoFinish,
        copies,
        specialInstructions: instructions.trim() || undefined,
        uploadedFiles: [
          {
            fileId: uploadedFile.fileId,
            originalName: uploadedFile.originalFilename,
            fileSize: uploadedFile.fileSize,
            mimeType: uploadedFile.mimeType,
          },
        ],
      },
    };
  };

  const handleAddToCart = () => {
    if (!validateInput()) return;
    addItem(buildServiceItem());
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
    }, 3000);
  };

  const handleDirectOrder = () => {
    if (!validateInput()) return;
    const item = buildServiceItem();
    const intent = createDirectServiceIntent(item);
    saveCheckoutIntent(intent);
    router.push("/checkout?intent=direct_service");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-xs font-semibold">
          <Camera className="w-4 h-4" />
          True-Tone Studio Photo Lab
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Photo Printing Studio
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm max-w-2xl leading-relaxed">
          Order authentic passport photographs conforming to official government visa specifications, 4×6 inch postcard memories, and high-definition studio portrait enlargements printed on 210 GSM Kodak photographic paper.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          {/* File Upload */}
          <FileUpload
            category="photo"
            label="Upload High-Resolution Photo"
            helperText="Supports JPEG, JPG, PNG, and WebP (Max 10 MB). Ensure good lighting with minimal blur."
            currentFile={uploadedFile}
            onFileUploaded={(f) => setUploadedFile(f)}
            onFileRemoved={() => setUploadedFile(null)}
          />

          {/* Photo Size Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Select Print Dimensions &amp; Size
            </label>
            <div className="space-y-2">
              {[
                {
                  key: "passport",
                  title: "Passport Size Set (35 × 45 mm)",
                  desc: "8 Identical photographs on one sheet, white background, Indian Passport / Visa spec",
                  price: "₹50 / set",
                },
                {
                  key: "stamp_size",
                  title: "Stamp Size Set (25 × 30 mm)",
                  desc: "16 Mini photographs on sheet, suited for admissions, bank forms and exam admit cards",
                  price: "₹50 / set",
                },
                {
                  key: "4x6",
                  title: '4 × 6 inch Studio Print (Postcard)',
                  desc: "Standard 10 × 15 cm album photograph printed on waterproof resin paper",
                  price: "₹15 / print",
                },
                {
                  key: "5x7",
                  title: '5 × 7 inch Studio Portrait',
                  desc: "13 × 18 cm table frame photo size for family portraits and convocations",
                  price: "₹30 / print",
                },
                {
                  key: "a4_photo",
                  title: 'A4 Studio Enlargement (8 × 12 inch)',
                  desc: "High-resolution full-page wall frame portrait print with vivid skin tones",
                  price: "₹80 / print",
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPhotoSize(opt.key)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
                    photoSize === opt.key
                      ? "border-rose-600 bg-rose-50/50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-1 ring-rose-600"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{opt.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950 px-2.5 py-1 rounded">
                    {opt.price}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Paper Texture / Finish */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Photographic Paper Finish
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPhotoFinish("glossy")}
                className={`p-3 rounded-xl border text-left transition ${
                  photoFinish === "glossy"
                    ? "border-rose-600 bg-rose-50/50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-1 ring-rose-600 font-semibold"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-sm font-bold">Ultra High Gloss</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Vibrant punchy colours, deep contrast, reflective sheen
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPhotoFinish("matte")}
                className={`p-3 rounded-xl border text-left transition ${
                  photoFinish === "matte"
                    ? "border-rose-600 bg-rose-50/50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-1 ring-rose-600 font-semibold"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-sm font-bold">Matte Silk (+₹5)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Anti-fingerprint soft grain finish preferred for framed displays
                </p>
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Number of Prints / Sets
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) =>
                  setCopies(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-28 px-4 py-2 rounded-xl input-theme text-sm font-bold text-center"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Printed on 210 GSM Kodak photographic paper
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Special Cropping / Retouching Instructions <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please crop close to face and shoulders, change background to plain white..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-4 py-2 rounded-xl input-theme text-sm"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleDirectOrder}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25 flex items-center justify-center gap-2 transition"
            >
              <Zap className="w-5 h-5" /> Order Photo Prints Now (Direct Checkout)
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAddToCart}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 ${
                  added
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" /> Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" /> Add to Cart
                  </>
                )}
              </button>

              <Link
                href="/cart"
                className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs text-center transition"
              >
                View Cart
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Price Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span>Price Summary</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                Server Calculation
              </span>
            </h3>

            <div className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Selected Size:</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right capitalize">
                  {photoSize.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paper Texture:</span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {photoFinish}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rate:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatINR(priceData.unitPrice)} / unit
                </span>
              </div>
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {copies} {copies === 1 ? "print" : "prints"}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-3 flex items-baseline justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-base">Estimated Total:</span>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                  {calculating ? "..." : formatINR(priceData.totalPrice)}
                </span>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">All taxes included</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
