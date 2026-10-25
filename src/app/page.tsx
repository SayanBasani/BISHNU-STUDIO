import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import {
  CreditCard,
  FileText,
  Layers,
  Camera,
  ShoppingBag,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Truck,
  QrCode,
  Search,
  ExternalLink,
  ChevronRight,
  PackageCheck,
  Lock,
} from "lucide-react";
import { db } from "@/db";
import {
  products,
  productImages,
  productCategories,
  services,
  servicePrices,
} from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { formatINR } from "@/lib/utils";
import { getShopSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { resolveBusinessName } from "@/lib/business";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Bishnu Studio — Document Printing, PVC Smart Cards & Stationery",
  description:
    "Professional document printing, PVC identity cards, studio photo prints, and office stationery in Barasat, West Bengal. Order online with instant UPI verification.",
};

export default async function HomePage() {
  // Parallel fetch independent homepage data to eliminate query waterfalls
  const [shop, categories, featuredProds, rateRows] = await Promise.all([
    getShopSettings().catch(() => ({ ...DEFAULT_SETTINGS, updatedAt: Date.now() })),
    db
      .select({
        id: productCategories.id,
        name: productCategories.name,
        slug: productCategories.slug,
      })
      .from(productCategories)
      .orderBy(productCategories.sortOrder)
      .limit(6)
      .catch((err) => {
        console.error("Failed to load categories for homepage:", err);
        return [];
      }),
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        price: products.price,
        discountedPrice: products.discountedPrice,
        stockQuantity: products.stockQuantity,
        isAvailable: products.isAvailable,
        sku: products.sku,
        categoryName: productCategories.name,
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(eq(products.isAvailable, true))
      .limit(8)
      .catch((err) => {
        console.error("Failed to load featured products for homepage:", err);
        return [];
      }),
    db
      .select({
        serviceKey: services.key,
        minPrice: sql<number>`min(${servicePrices.price})`,
      })
      .from(services)
      .leftJoin(servicePrices, eq(services.id, servicePrices.serviceId))
      .groupBy(services.key)
      .catch((err) => {
        console.error("Failed to load service starting prices:", err);
        return [];
      }),
  ]);

  const effectiveShopName = resolveBusinessName(shop.shopName);
  const isStoreOpen = (shop as any).isOpen !== undefined ? Boolean((shop as any).isOpen) : true;
  const closedMessage = (shop as any).closedMessage || "We are currently closed for new orders. Store browsing and existing order tracking remain active.";

  // Fetch only images belonging to the featured 8 products, preventing unbounded table scans
  const prodIds = featuredProds.map((p) => p.id);
  let images: any[] = [];
  if (prodIds.length > 0) {
    try {
      images = await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, prodIds));
    } catch (err) {
      console.error("Failed to load product images:", err);
    }
  }

  const productsWithImages = featuredProds.map((p) => {
    const prodImg =
      images.find((img) => img.productId === p.id && img.isPrimary) ||
      images.find((img) => img.productId === p.id);
    return {
      ...p,
      imageUrl: prodImg?.imageUrl || null,
    };
  });

  // Map Authoritative Database Service Starting Prices
  const serviceRatesMap: Record<string, number> = {};
  if (rateRows) {
    for (const r of rateRows as any[]) {
      if (r.serviceKey && r.minPrice !== null && r.minPrice !== undefined) {
        serviceRatesMap[r.serviceKey] = Number(r.minPrice);
      }
    }
  }

  // Structured Core Services with Real Rates
  const coreServices = [
    {
      key: "pvc_card",
      title: "PVC Smart Cards",
      category: "Identity & Access",
      desc: "Waterproof, ISO standard 0.76mm credit-card thickness. Ideal for Aadhaar, PAN, Driving Licence, Voter ID, and organization cards.",
      href: "/services/pvc-card",
      icon: CreditCard,
      startingPrice: serviceRatesMap["pvc_card"] ? `From ${formatINR(serviceRatesMap["pvc_card"])}` : "From ₹50",
      specs: ["0.76mm Thick PVC", "Waterproof Pigment", "Aadhaar & PAN Ready"],
    },
    {
      key: "document_print",
      title: "Document Printing",
      category: "Laser Printing",
      desc: "High-speed laser printing for legal drafts, academic papers, reports, and books. Instant automated PDF page counting.",
      href: "/services/document-printing",
      icon: FileText,
      startingPrice: serviceRatesMap["document_print"] ? `From ${formatINR(serviceRatesMap["document_print"])}/page` : "From ₹2.50/page",
      specs: ["A4, Legal & A3", "B&W & Rich Colour", "Single & Duplex"],
    },
    {
      key: "photo_print",
      title: "Studio Photo Printing",
      category: "Lab Photographic",
      desc: "Official government-spec passport photo sets, stamp sizes, 4×6 inch postcards, and high-definition framed enlargements.",
      href: "/services/photo-printing",
      icon: Camera,
      startingPrice: serviceRatesMap["photo_print"] ? `From ${formatINR(serviceRatesMap["photo_print"])}/print` : "From ₹15/print",
      specs: ["Standard 35×45mm Sets", "Glossy & Matte Finishes", "High-Density DPI"],
    },
    {
      key: "lamination",
      title: "Certificate Lamination",
      category: "Thermal Protection",
      desc: "Heavy-duty thermal pouch sealing to permanently shield certificates, legal documents, marks-sheets, and ID badges against spills and wear.",
      href: "/services/lamination",
      icon: Layers,
      startingPrice: serviceRatesMap["lamination"] ? `From ${formatINR(serviceRatesMap["lamination"])}/sheet` : "From ₹10/sheet",
      specs: ["125 to 250 Micron", "Heat-Sealed Pouch", "Anti-Scratch Barrier"],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* =========================================================================
          HERO SECTION — Editorial Split Commerce Presentation
         ========================================================================= */}
      <section className="relative border-b border-slate-200/80 dark:border-slate-800/80 pt-8 sm:pt-14 pb-14 sm:pb-20 bg-white dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Mission, Typography & Primary Actions */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Stationery Store &bull; Professional Printing Studio</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
                Custom Printing Services &amp; Everyday Stationery Supplies
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Order document printing, waterproof PVC smart cards, and studio portraits online with transparent server pricing. Collect at our Barasat counter or receive doorstep delivery.
              </p>

              {/* Primary Call to Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Link
                  href="/services/document-printing"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Order Printing Online
                </Link>

                <Link
                  href="/shop"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm border border-slate-200 dark:border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-slate-500" />
                  Browse Stationery Shop
                </Link>

                <Link
                  href="/services/pvc-card"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm border border-slate-200 dark:border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  PVC Cards
                </Link>
              </div>

              {/* Key Trust Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 dark:border-slate-800/80 text-left">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Authenticated Private Documents</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Authoritative Database Rates</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <QrCode className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Permanent UPI Reconciliation</span>
                </div>
              </div>
            </div>

            {/* Right Column: Studio Overview & Counter Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {effectiveShopName} Counter
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Physical Store &bull; {shop.cityTown || "Barasat"}, {shop.state || "West Bengal"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isStoreOpen
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isStoreOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                      }`}
                    />
                    {isStoreOpen ? "Open Today" : "Closed Today"}
                  </span>
                </div>

                {!isStoreOpen && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      Orders Temporarily Halted
                    </span>
                    <p className="leading-relaxed">{closedMessage}</p>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Address
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {shop.building ? `${shop.building}, ` : ""}
                        {shop.street ? `${shop.street}, ` : ""}
                        {shop.landmark ? `Near ${shop.landmark}, ` : ""}
                        {shop.cityTown}, {shop.state} &ndash; {shop.pinCode}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Counter Operating Hours
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {shop.openingHours || "Monday &ndash; Saturday: 8:00 AM &ndash; 9:30 PM | Sunday: 10:00 AM &ndash; 4:00 PM"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <QrCode className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Verified Shop UPI Handle
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] mt-0.5">
                        {shop.upiId}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                  <Link
                    href="/account/orders"
                    className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-semibold text-xs flex items-center justify-between transition"
                  >
                    <span>Track an Existing Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRINTING SERVICES SECTION — Clear Grid with Dynamic Database Rates
         ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-2xl mb-10">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
            Printing &amp; Finishing
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Specialized Print Services
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Accurate, server-calculated pricing with instant file validation. Pick up at our counter or opt for delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {coreServices.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.key}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:border-slate-400 dark:hover:border-slate-600 transition group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      {srv.startingPrice}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {srv.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {srv.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {srv.desc}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {srv.specs.map((spec, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <Link
                    href={srv.href}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Configure Service</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          STATIONERY STORE & PRODUCT DISCOVERY — Real Database Products
         ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
              Store Catalogue
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Featured Stationery Supplies
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Authoritative stock and pricing directly from our store inventory.
            </p>
          </div>

          <Link
            href="/shop"
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>View Full Shop</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Category Filter Pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Link
              href="/shop"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition"
            >
              All Categories
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/shop?category=${c.slug}`}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {/* Product Cards Grid */}
        {productsWithImages.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
            <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Inventory Refresh in Progress
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Our retail catalogue is being synchronized. Please browse our complete shop or visit our store counter directly.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold"
            >
              Browse Shop &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsWithImages.map((prod) => {
              const hasDiscount =
                prod.discountedPrice &&
                prod.discountedPrice > 0 &&
                prod.discountedPrice < prod.price;

              return (
                <div
                  key={prod.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm hover:border-slate-400 dark:hover:border-slate-600 transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Product Image Container */}
                    <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800/80 overflow-hidden flex items-center justify-center">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300 motion-reduce:transition-none"
                        />
                      ) : (
                        <div className="p-4 text-center text-slate-400">
                          <ShoppingBag className="w-8 h-8 mx-auto mb-1 stroke-1" />
                          <span className="text-[11px] font-medium">{effectiveShopName}</span>
                        </div>
                      )}

                      {hasDiscount && prod.discountedPrice && (
                        <span className="absolute top-2.5 left-2.5 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          SAVE {Math.round(((prod.price - prod.discountedPrice) / prod.price) * 100)}%
                        </span>
                      )}

                      <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                        {prod.stockQuantity > 0 ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    {/* Metadata & Title */}
                    <div className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono text-[10px]">{prod.sku}</span>
                        {prod.categoryName && (
                          <span className="font-medium text-slate-600 dark:text-slate-400">
                            {prod.categoryName}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">
                        {prod.name}
                      </h3>

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white">
                          {formatINR(prod.discountedPrice || prod.price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-slate-400 line-through">
                            {formatINR(prod.price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <Link
                      href={`/shop/${prod.id}`}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-center transition"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          THE BISHNU STUDIO STANDARD — Verifiable Quality & Trust
         ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-2xl mb-10">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
            Service Commitment
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            The {effectiveShopName} Standard
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Reliable, verifiable features backing every order placed online or at our counter.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Strict Document Privacy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Uploaded Aadhaar, PAN, and certificates are kept in private storage with authenticated ownership access and auto-shredding.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Server-Verified Pricing
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every copy, page count, and add-on rate is verified authoritative on the server. No surprise checkout fees.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              UPI State Machine
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              NPCI QR generation, immutable receiving UPI snapshots, and human administrative UTR verification prevent mismatched payments.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Flexible Fulfillment
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose zero-cost counter pickup at Barasat to skip lines, or select direct doorstep dispatch for bulk printing.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ORDER TRACKING & CUSTOMER CONVENIENCE SECTION
         ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
          <div className="space-y-3 max-w-xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Customer Self-Service</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Track Your Print Job or Order Status
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Follow your order through confirmation, administrative UPI verification, high-resolution printing, and counter packaging.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
            <Link
              href="/account/orders"
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition text-center shadow"
            >
              My Orders &amp; Tracking
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition text-center"
            >
              Counter Directions
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
