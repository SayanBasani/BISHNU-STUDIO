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
  FileText,
  Check,
  ShoppingBag,
  Sparkles,
  Layers,
  HelpCircle,
  Zap,
} from "lucide-react";

export default function DocumentPrintingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [paperSize, setPaperSize] = useState("A4");
  const [printMode, setPrintMode] = useState<"bw" | "color">("bw");
  const [sides, setSides] = useState<"single" | "double">("single");
  const [copies, setCopies] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [includeLamination, setIncludeLamination] = useState(false);
  const [instructions, setInstructions] = useState("");

  const [priceData, setPriceData] = useState<{
    unitPrice: number;
    totalPrice: number;
    description: string;
  }>({
    unitPrice: 3,
    totalPrice: 3,
    description: "A4 B&W Single-Sided",
  });
  const [calculating, setCalculating] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When a file is uploaded, set verified server page count
  useEffect(() => {
    if (uploadedFile?.pageCount) {
      setPageCount(uploadedFile.pageCount);
    }
  }, [uploadedFile]);

  // Recalculate price dynamically whenever any configuration changes
  useEffect(() => {
    let isCancelled = false;
    const fetchPrice = async () => {
      setCalculating(true);
      try {
        const res = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceType: "document_print",
            payload: {
              paperSize,
              printMode,
              sides,
              pageCount,
              copies,
              includeLamination,
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
        console.error("Price calculate failed:", err);
      } finally {
        if (!isCancelled) setCalculating(false);
      }
    };

    fetchPrice();
    return () => {
      isCancelled = true;
    };
  }, [paperSize, printMode, sides, pageCount, copies, includeLamination]);

  const validateInput = (): boolean => {
    setError(null);
    if (!user) {
      setError("Please log in or register before submitting your document order.");
      return false;
    }
    if (!uploadedFile) {
      setError("Please upload your document file (PDF or image).");
      return false;
    }
    return true;
  };

  const buildServiceItem = () => {
    return {
      id: `cart_doc_${Date.now()}`,
      itemType: "document_print" as const,
      name: `Document Print (${paperSize} ${printMode === "color" ? "Colour" : "B&W"})`,
      description: `${pageCount} Pgs × ${copies} ${copies === 1 ? "Set" : "Sets"} | ${
        sides === "double" ? "Back-to-Back" : "Single-Sided"
      }${includeLamination ? " + Lamination" : ""} | File: ${uploadedFile.originalFilename}`,
      quantity: copies,
      unitPrice: priceData.unitPrice,
      totalPrice: priceData.totalPrice,
      serviceId: "srv_doc",
      fileIds: [uploadedFile.fileId],
      configuration: {
        paperSize,
        printMode,
        sides,
        pageCount,
        includeLamination,
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
          <FileText className="w-4 h-4" />
          High-Speed Laser &amp; Inkjet Printing
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Document Printing &amp; Lamination
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm max-w-2xl leading-relaxed">
          Upload your PDF document or images, select paper size and colour modes. Our server will automatically calculate exact page counts and live pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          {/* File Upload */}
          <FileUpload
            category="general_document"
            label="Upload Document (PDF or Clear Image)"
            helperText="PDF documents will be automatically analysed on our server to extract verified page counts."
            currentFile={uploadedFile}
            onFileUploaded={(f) => setUploadedFile(f)}
            onFileRemoved={() => {
              setUploadedFile(null);
              setPageCount(1);
            }}
          />

          {/* Paper Size Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Paper Size
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "A4", label: "A4 (Standard)", desc: "210 × 297 mm" },
                { key: "Legal", label: "Legal", desc: "216 × 356 mm" },
                { key: "A3", label: "A3 (Large)", desc: "297 × 420 mm" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setPaperSize(s.key)}
                  className={`p-3 rounded-xl border text-left transition ${
                    paperSize === s.key
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold ring-1 ring-blue-600"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                  }`}
                >
                  <p className="text-sm font-bold">{s.label}</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Print Mode: Black & White vs Colour */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Colour Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrintMode("bw")}
                className={`p-3.5 rounded-xl border text-left transition ${
                  printMode === "bw"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold ring-1 ring-blue-600"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-sm font-bold">Black &amp; White (Monochrome)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Crisp 1200 DPI laser text for contracts, notes, and legal copies
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode("color")}
                className={`p-3.5 rounded-xl border text-left transition ${
                  printMode === "color"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold ring-1 ring-blue-600"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-sm font-bold">Full Colour</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Vibrant graphics, certificates, graphs, and presentation slides
                </p>
              </button>
            </div>
          </div>

          {/* Printing Sides: Single vs Double Sided */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Print Sides
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSides("single")}
                className={`p-3 rounded-xl border text-left transition ${
                  sides === "single"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold ring-1 ring-blue-600"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-sm font-bold">Single-Sided</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">One page per sheet</p>
              </button>

              <button
                type="button"
                onClick={() => setSides("double")}
                className={`p-3 rounded-xl border text-left transition ${
                  sides === "double"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold ring-1 ring-blue-600"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-sm font-bold">Double-Sided (Duplex)</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Back-to-back economical printing</p>
              </button>
            </div>
          </div>

          {/* Quantities & Pages */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Pages in Document
              </label>
              <input
                type="number"
                min="1"
                max="2000"
                value={pageCount}
                onChange={(e) =>
                  setPageCount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full px-3 py-2 rounded-xl input-theme text-sm font-bold text-center"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                Auto-detected from uploaded PDF
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Number of Sets / Copies
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={copies}
                onChange={(e) =>
                  setCopies(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full px-3 py-2 rounded-xl input-theme text-sm font-bold text-center"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                Total prints: {pageCount * copies} pages
              </p>
            </div>
          </div>

          {/* Lamination Addon Toggle */}
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/30 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Include Thermal Lamination
              </span>
              <p className="text-xs text-purple-800/80 dark:text-purple-300/80">
                Seal your printed sheets with moisture-proof glossy protective film.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={includeLamination}
                onChange={(e) => setIncludeLamination(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Special Instructions */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Special Finishing Instructions <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Corner staple, spiral binding, page range 1-10 only..."
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
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition"
            >
              <Zap className="w-5 h-5" /> Order Document Printing Now (Direct Checkout)
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

        {/* Right: Live Price Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span>Cost Breakdown</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Verified Server Calculation
              </span>
            </h3>

            <div className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Selected Format:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {paperSize} {printMode === "color" ? "Colour" : "B&W"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Printing Sides:</span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {sides === "double" ? "Double Sided" : "Single Sided"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Pages:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {pageCount} pgs × {copies} {copies === 1 ? "copy" : "copies"} ({pageCount * copies} prints)
                </span>
              </div>
              {includeLamination && (
                <div className="flex justify-between text-purple-700 dark:text-purple-300">
                  <span>Lamination Addon:</span>
                  <span className="font-semibold">Included</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-3 flex items-baseline justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-base">Estimated Price:</span>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
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
