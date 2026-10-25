"use client";

import React, { useState, useEffect } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Printer,
  Navigation,
  CheckCircle2,
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

export default function ContactPage() {
  const [shop, setShop] = useState<ShopInfo>({
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
  });

  useEffect(() => {
    fetch("/api/settings/shop")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.shop) {
          setShop({
            shopName: data.shop.shopName || "Bishnu Studio",
            building: data.shop.building || "12/B Station Road",
            street: data.shop.street || "Main Market",
            landmark: data.shop.landmark,
            city: data.shop.city || "Barasat",
            state: data.shop.state || "West Bengal",
            pinCode: data.shop.pinCode || "700001",
            contactPhone: data.shop.contactPhone || "+91 98765 43210",
            contactEmail: data.shop.contactEmail || "support@bishnustudio.com",
            openingHours: data.shop.openingHours || "Mon – Sat: 9:00 AM – 9:00 PM",
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Visit {shop.shopName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-2xl leading-relaxed">
          We are located at the heart of the town market. Feel free to drop by for direct counter collections, custom corporate print inquiries, or stationery purchases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Contact Info Card */}
        <div className="md:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{shop.shopName}</h2>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                Printing, Smart Cards &amp; Office Stationery
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white block">Physical Counter Address:</strong>
                <p>{shop.building}, {shop.street}</p>
                {shop.landmark && <p>Near {shop.landmark}</p>}
                <p>{shop.city}, {shop.state} - {shop.pinCode}, India</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white block">Phone &amp; WhatsApp:</strong>
                <p className="font-mono">{shop.contactPhone}</p>
                <p className="text-xs text-gray-400">Available during shop operating hours</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white block">Email Inquiries:</strong>
                <p className="font-mono">{shop.contactEmail}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900 dark:text-white block">Counter Opening Hours:</strong>
                <p>{shop.openingHours}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  Open for counter pickup &amp; urgent print jobs
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Collection Instructions */}
        <div className="md:col-span-6 space-y-6">
          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Navigation className="w-5 h-5" />
              <span>Counter Collection Guide</span>
            </div>
            <h3 className="text-xl font-bold">Collecting Your Order in Person</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              When placing your order online, choose <strong>Store Pickup (FREE)</strong>.
            </p>
            <ul className="text-xs text-gray-300 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>You will see the live status update to <strong>Ready for Pickup</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Visit our counter and show your <strong>Order Reference (e.g. BS-2610-1234)</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Inspect your printed cards/documents and pay via Cash or UPI on collection if not prepaid.</span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 text-xs text-gray-500 dark:text-gray-400 space-y-2 shadow-sm">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Corporate &amp; School Bulk Orders</h4>
            <p className="leading-relaxed">
              For volume printing (over 1,000 pages, school ID cards, certificate lamination batches), contact the studio counter directly at <strong className="text-gray-800 dark:text-gray-200">{shop.contactPhone}</strong> or email your RFQ to <strong className="text-gray-800 dark:text-gray-200">{shop.contactEmail}</strong> for custom institutional discounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
