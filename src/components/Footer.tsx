"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchPublicShopSettings } from "@/lib/public-settings";
import {
  Printer,
  Shield,
  Phone,
  Mail,
  MapPin,
  Clock,
  Lock,
} from "lucide-react";

interface ShopInfo {
  shopName: string;
  building: string;
  street: string;
  landmark?: string | null;
  city: string;
  state: string;
  pinCode: string;
  contactPhone: string;
  contactEmail: string;
  openingHours: string;
}

let cachedFooterShop: ShopInfo | null = null;

export default function Footer() {
  const [shop, setShop] = useState<ShopInfo>(
    () =>
      cachedFooterShop || {
        shopName: "Bishnu Studio",
        building: "12/B Station Road",
        street: "Main Market, Near Railway Crossing",
        landmark: "Opposite Town Post Office",
        city: "Barasat",
        state: "West Bengal",
        pinCode: "700001",
        contactPhone: "+91 98765 43210",
        contactEmail: "support@bishnustudio.com",
        openingHours: "Mon – Sat: 9:00 AM – 9:00 PM | Sun: 10:00 AM – 6:00 PM",
      }
  );

  useEffect(() => {
    if (cachedFooterShop) {
      setShop(cachedFooterShop);
      return;
    }

    fetchPublicShopSettings().then((payload) => {
      if (payload) {
        const loaded: ShopInfo = {
          shopName: payload.shopName || "Bishnu Studio",
          building: payload.building || "12/B Station Road",
          street: payload.street || "Main Market",
          landmark: payload.landmark,
          city: payload.cityTown || payload.city || "Barasat",
          state: payload.state || "West Bengal",
          pinCode: payload.pinCode || "700001",
          contactPhone: payload.contactPhone || "+91 98765 43210",
          contactEmail: payload.contactEmail || "support@bishnustudio.com",
          openingHours: payload.openingHours || "Mon – Sat: 9:00 AM – 9:00 PM",
        };
        cachedFooterShop = loaded;
        setShop(loaded);
      }
    });
  }, []);

  return (
    <footer className="bg-slate-900 text-gray-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Col 1: Brand & Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white">
                  {shop.shopName}
                </span>
                <span className="block text-xs uppercase tracking-wider text-blue-400 font-semibold">
                  Printing &amp; Stationery Hub
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your trusted neighbourhood centre for professional PVC identity card printing, high-speed document printing, precision thermal lamination, studio photo prints, and quality office stationery.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-2.5">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Strict document privacy &amp; 30-day auto-shredding policy.</span>
            </div>
          </div>

          {/* Col 2: Services */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Printing &amp; Services
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/services/pvc-card"
                  className="hover:text-blue-400 transition"
                >
                  PVC Card Printing (Aadhaar, PAN, DL)
                </Link>
              </li>
              <li>
                <Link
                  href="/services/document-printing"
                  className="hover:text-blue-400 transition"
                >
                  Document Printing &amp; Binding (B&amp;W/Colour)
                </Link>
              </li>
              <li>
                <Link
                  href="/services/lamination"
                  className="hover:text-blue-400 transition"
                >
                  Certificate &amp; Document Lamination
                </Link>
              </li>
              <li>
                <Link
                  href="/services/photo-printing"
                  className="hover:text-blue-400 transition"
                >
                  Studio Photo &amp; Passport Prints
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-blue-400 transition">
                  Office &amp; School Stationery Shop
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Customer Care & Policy */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Customer Support &amp; Policy
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/account/orders"
                  className="hover:text-blue-400 transition"
                >
                  Track Order Status
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-blue-400 transition">
                  Returns &amp; Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-blue-400 transition">
                  Privacy Policy &amp; Document Safety
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-blue-400 transition">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-400 transition">
                  Shop Information &amp; Location
                </Link>
              </li>
              <li>
                <Link href="/developer" className="hover:text-blue-400 transition">
                  Developer &amp; Credits
                </Link>
              </li>
              <li className="pt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Private authenticated downloads only</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4: Shop Contact & Hours (Dynamic) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Visit {shop.shopName}
            </h3>
            <div className="flex items-start gap-2.5 text-sm text-gray-400">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                {shop.building}, {shop.street}
                {shop.landmark ? `, Near ${shop.landmark}` : ""}
                <br />
                {shop.city}, {shop.state} - {shop.pinCode}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-400">
              <Phone className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-mono">{shop.contactPhone}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-400">
              <Mail className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-mono">{shop.contactEmail}</span>
            </div>
            <div className="flex items-start gap-2.5 text-sm text-gray-400 pt-1">
              <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Counter Opening Hours</p>
                <p className="text-xs text-gray-400">{shop.openingHours}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p>© {new Date().getFullYear()} {shop.shopName}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/developer" className="hover:text-gray-400">
              Website Credits
            </Link>
            <Link href="/returns" className="hover:text-gray-400">
              Returns &amp; Refunds
            </Link>
            <Link href="/privacy" className="hover:text-gray-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gray-400">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-gray-400">
              Contact Shop
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
