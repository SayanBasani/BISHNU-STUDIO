"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/utils";
import {
  ShoppingBag,
  Store,
  Truck,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Home,
  Briefcase,
  Navigation,
  Check,
  Star,
  Zap,
} from "lucide-react";
import { getActiveCheckoutIntent, clearCheckoutIntent, CheckoutIntent } from "@/lib/checkout";

interface SavedAddress {
  id: string;
  recipientName: string;
  recipientPhone: string;
  addressType: "home" | "work" | "other";
  label: string;
  houseBuilding: string;
  streetLocality: string;
  landmark?: string | null;
  cityTown: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { items, cartSubtotal, clearCart, removeItems } = useCart();

  const [checkoutIntent, setCheckoutIntent] = useState<CheckoutIntent | null>(null);
  const [intentLoaded, setIntentLoaded] = useState(false);

  const [deliveryType, setDeliveryType] = useState<"store_pickup" | "home_delivery">("store_pickup");
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_collection" | "upi_mock">("cash_on_collection");
  const [orderNotes, setOrderNotes] = useState("");

  // Multiple saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // New address modal state
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressType, setAddressType] = useState<"home" | "work" | "other">("home");
  const [houseBuilding, setHouseBuilding] = useState("");
  const [streetLocality, setStreetLocality] = useState("");
  const [landmark, setLandmark] = useState("");
  const [cityTown, setCityTown] = useState("");
  const [state, setState] = useState("West Bengal");
  const [pinCode, setPinCode] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressFormError, setAddressFormError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store availability & business branding
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  const [checkoutBrandName, setCheckoutBrandName] = useState("Bishnu Studio");

  useEffect(() => {
    fetch("/api/settings/shop")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data?.settings || data?.shop;
        if (payload) {
          if (payload.isOpen !== undefined) setIsStoreOpen(Boolean(payload.isOpen));
          if (payload.closedMessage) setClosedMessage(payload.closedMessage);
          if (payload.shopName) setCheckoutBrandName(payload.shopName);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user]);

  useEffect(() => {
    const active = getActiveCheckoutIntent();
    if (active && active.items.length > 0) {
      setCheckoutIntent(active);
    }
    setIntentLoaded(true);
  }, []);

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const res = await fetch("/api/account/addresses");
      if (res.ok) {
        const data = await res.json();
        const addrs: SavedAddress[] = data.addresses || [];
        setSavedAddresses(addrs);
        if (addrs.length > 0) {
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          setSelectedAddressId(def.id);
        }
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleCreateNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    if (!recipientName.trim()) {
      setAddressFormError("Recipient name is required.");
      return;
    }
    if (!/^[0-9]{10}$/.test(recipientPhone.trim())) {
      setAddressFormError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!houseBuilding.trim() || !streetLocality.trim() || !cityTown.trim() || !pinCode.trim()) {
      setAddressFormError("Please fill in all required address fields.");
      return;
    }
    if (!/^[0-9]{6}$/.test(pinCode.trim())) {
      setAddressFormError("PIN code must be a 6-digit number.");
      return;
    }

    setSavingAddress(true);
    try {
      const payload = {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        addressType,
        houseBuilding: houseBuilding.trim(),
        streetLocality: streetLocality.trim(),
        landmark: landmark.trim() || null,
        cityTown: cityTown.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        isDefault: savedAddresses.length === 0,
      };

      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save address.");
      }

      setAddressModalOpen(false);
      await loadAddresses();
      if (data.address?.id) {
        setSelectedAddressId(data.address.id);
      }
    } catch (err: any) {
      setAddressFormError(err.message || "Failed to save address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const checkoutItems = checkoutIntent ? checkoutIntent.items : items;
  const checkoutSubtotal = Math.round(
    checkoutItems.reduce((acc, item) => acc + item.totalPrice, 0) * 100
  ) / 100;
  const deliveryCharge =
    deliveryType === "home_delivery" && checkoutSubtotal < 500 ? 40 : 0;
  const grandTotal = Math.round((checkoutSubtotal + deliveryCharge) * 100) / 100;

  if (authLoading || !intentLoaded) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in to Checkout</h2>
        <p className="text-gray-500 text-sm">
          Please log in or register so we can link your printing orders and document files securely to your account.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/login?redirect=/checkout"
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Register
          </Link>
        </div>
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">No Items to Checkout</h2>
        <p className="text-gray-500 text-sm">Your checkout session currently does not contain any items.</p>
        <Link
          href="/cart"
          className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
        >
          Return to Cart
        </Link>
      </div>
    );
  }

  const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isStoreOpen) {
      setError(closedMessage || "The store is currently closed for new orders. Please check back later.");
      return;
    }

    if (deliveryType === "home_delivery") {
      if (!selectedAddress) {
        setError("Please select or add a delivery address for home delivery.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const orderPayload = {
        deliveryType,
        paymentMethod,
        orderNotes: orderNotes.trim() || undefined,
        shippingAddress:
          deliveryType === "home_delivery" && selectedAddress
            ? {
                recipientName: selectedAddress.recipientName || user.fullName,
                recipientPhone: selectedAddress.recipientPhone || user.phone,
                addressType: selectedAddress.addressType || "home",
                houseBuilding: selectedAddress.houseBuilding,
                streetLocality: selectedAddress.streetLocality,
                landmark: selectedAddress.landmark || null,
                cityTown: selectedAddress.cityTown,
                state: selectedAddress.state,
                pinCode: selectedAddress.pinCode,
              }
            : undefined,
        items: checkoutItems.map((item) => ({
          itemType: item.itemType,
          productId: item.productId,
          serviceId: item.serviceId,
          quantity: item.quantity,
          configuration: item.configuration || {},
          specialInstructions: item.configuration?.specialInstructions,
          fileIds: item.fileIds || item.configuration?.uploadedFiles?.map((f: any) => f.fileId) || [],
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order.");
      }

      // Order created successfully! Reconcile cart according to checkout intent:
      if (checkoutIntent?.type === "selected_items" && checkoutIntent.sourceCartItemIds) {
        // Remove ONLY the selected items that were purchased
        removeItems(checkoutIntent.sourceCartItemIds);
      } else if (!checkoutIntent || checkoutIntent.type === "cart") {
        // Full regular cart checkout
        clearCart();
      }
      // If type === "buy_now" or "direct_service", regular cart is NOT touched!

      clearCheckoutIntent();

      if (paymentMethod === "upi_mock") {
        router.push(`/checkout/payment/${data.orderId}`);
      } else {
        router.push(`/account/orders/${data.orderId}`);
      }
    } catch (err: any) {
      setError(err?.message || "Order creation failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Checkout
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          Confirm delivery preferences, select shipping address, choose payment mode, and place your order.
        </p>
      </div>

      {/* Store Closed Warning Banner */}
      {!isStoreOpen && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm">Store is Currently Closed for Orders</strong>
            <p className="mt-0.5 leading-relaxed">
              {closedMessage || "We are currently closed for new orders. Store browsing and existing order tracking remain active."}
            </p>
          </div>
        </div>
      )}

      {/* Checkout Intent Mode Banner */}
      {checkoutIntent?.type === "buy_now" ? (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Buy Now Direct Checkout:</strong> You are purchasing only this chosen item. Your ordinary cart items are preserved.
            </span>
          </div>
          <Link href="/cart" className="text-amber-700 dark:text-amber-300 font-bold hover:underline shrink-0 ml-2">
            View Cart &rarr;
          </Link>
        </div>
      ) : checkoutIntent?.type === "selected_items" ? (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs text-blue-800 dark:text-blue-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong>Selective Checkout:</strong> Purchasing {checkoutItems.length} selected {checkoutItems.length === 1 ? "item" : "items"}. Unselected cart items remain safe in your cart.
            </span>
          </div>
          <Link href="/cart" className="text-blue-700 dark:text-blue-300 font-bold hover:underline shrink-0 ml-2">
            Modify Selection &rarr;
          </Link>
        </div>
      ) : checkoutIntent?.type === "direct_service" ? (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Direct Service Order:</strong> Processing only this printing request. Your retail cart items remain preserved.
            </span>
          </div>
          <Link href="/cart" className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline shrink-0 ml-2">
            View Cart &rarr;
          </Link>
        </div>
      ) : null}

      <form onSubmit={handleSubmitOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Form: Delivery & Address & Payment */}
          <div className="lg:col-span-7 space-y-6">
            {/* Delivery Method */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                1. Delivery Preference
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDeliveryType("store_pickup")}
                  className={`p-4 rounded-xl border text-left transition ${
                    deliveryType === "store_pickup"
                      ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-600/20"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Store
                      className={`w-5 h-5 ${
                        deliveryType === "store_pickup"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    />
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      Store Pickup
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Collect at Bishnu Studio counter. <strong>FREE</strong> &bull; Same day ready
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType("home_delivery")}
                  className={`p-4 rounded-xl border text-left transition ${
                    deliveryType === "home_delivery"
                      ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-600/20"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Truck
                      className={`w-5 h-5 ${
                        deliveryType === "home_delivery"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    />
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      Home Delivery
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Direct to doorstep. Free for orders over ₹500, else ₹40.
                  </p>
                </button>
              </div>
            </div>

            {/* Selectable Saved Addresses (Flipkart / Amazon style) */}
            {deliveryType === "home_delivery" && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    2. Select Delivery Address
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientName(user.fullName || "");
                      setRecipientPhone(user.phone || "");
                      setAddressType("home");
                      setHouseBuilding("");
                      setStreetLocality("");
                      setLandmark("");
                      setCityTown("");
                      setState("West Bengal");
                      setPinCode("");
                      setAddressFormError(null);
                      setAddressModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Address
                  </button>
                </div>

                {loadingAddresses ? (
                  <div className="py-8 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
                    <p className="text-xs mt-2">Loading saved addresses...</p>
                  </div>
                ) : savedAddresses.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-center space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      You do not have any saved delivery addresses yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAddressModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                    >
                      + Add Delivery Address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      const TypeIcon =
                        addr.addressType === "work"
                          ? Briefcase
                          : addr.addressType === "other"
                          ? Navigation
                          : Home;

                      return (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/20 dark:bg-blue-950/40 ring-2 ring-blue-600/20"
                              : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryAddressSelector"
                            checked={isSelected}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-gray-900 dark:text-white">
                                {addr.recipientName || user.fullName}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                <TypeIcon className="w-2.5 h-2.5" />
                                {addr.addressType}
                              </span>
                              {addr.isDefault && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                  Default
                                </span>
                              )}
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 ml-auto">
                                {addr.recipientPhone || user.phone}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                              {addr.houseBuilding}, {addr.streetLocality}
                              {addr.landmark ? `, Near ${addr.landmark}` : ""}
                              <br />
                              {addr.cityTown}, {addr.state} -{" "}
                              <strong className="text-gray-800 dark:text-gray-200 font-mono">
                                {addr.pinCode}
                              </strong>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {deliveryType === "home_delivery" ? "3." : "2."} Payment Mode
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash_on_collection")}
                  className={`p-4 rounded-xl border text-left transition ${
                    paymentMethod === "cash_on_collection"
                      ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-600/20"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Store
                      className={`w-5 h-5 ${
                        paymentMethod === "cash_on_collection"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    />
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      Cash on Counter / Delivery
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pay in cash or UPI QR code at our shop counter or on parcel arrival.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi_mock")}
                  className={`p-4 rounded-xl border text-left transition ${
                    paymentMethod === "upi_mock"
                      ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-600/20"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <QrCode
                      className={`w-5 h-5 ${
                        paymentMethod === "upi_mock"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    />
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      UPI QR Payment
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Scan shop UPI QR code (GPay, PhonePe, Paytm). Order placed as pending until verified.
                  </p>
                </button>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-3 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Order Notes / Special Instructions
              </h2>
              <textarea
                rows={2}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Any special handling notes, pickup time preference, or remarks for Bishnu Studio..."
                className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
              />
            </div>
          </div>

          {/* Right Summary: Items & Price Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-6 sticky top-24">
              <h3 className="font-bold text-base text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3">
                Order Summary ({checkoutItems.length} {checkoutItems.length === 1 ? "item" : "items"})
              </h3>

              {/* Items List Mini */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {checkoutItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-xs py-1.5 border-b border-gray-50 dark:border-slate-800/60"
                  >
                    <div className="truncate pr-3">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 block truncate">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Qty: {item.quantity} &bull; {item.description}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-gray-900 dark:text-white shrink-0">
                      {formatINR(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Calculation */}
              <div className="space-y-2 text-xs border-t border-gray-100 dark:border-slate-800 pt-4">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{formatINR(checkoutSubtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Delivery Charge</span>
                  <span className="font-mono font-medium">
                    {deliveryCharge === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">FREE</span>
                    ) : (
                      formatINR(deliveryCharge)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-gray-900 dark:text-white border-t border-gray-200 dark:border-slate-800 pt-3">
                  <span>Total Amount</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{formatINR(grandTotal)}</span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !isStoreOpen}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg disabled:opacity-60 transition flex items-center justify-center gap-2 ${
                  !isStoreOpen
                    ? "bg-gray-400 dark:bg-slate-700 text-white cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Placing Order...
                  </>
                ) : !isStoreOpen ? (
                  "Store is Closed for Orders"
                ) : (
                  `Confirm & Place Order (${formatINR(grandTotal)})`
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 pt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Verified by {checkoutBrandName} Secure Checkout</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Add New Address Modal for Checkout */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Delivery Address</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Enter recipient contact and address details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg text-lg"
              >
                &times;
              </button>
            </div>

            {addressFormError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addressFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewAddress} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Rahul Sen"
                    className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    10-digit Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["home", "work", "other"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition ${
                        addressType === type
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Flat, House no., Building, Apartment *
                </label>
                <input
                  type="text"
                  required
                  value={houseBuilding}
                  onChange={(e) => setHouseBuilding(e.target.value)}
                  placeholder="e.g. Flat 3B, Sunshine Apartments"
                  className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Area, Street, Sector, Village *
                </label>
                <input
                  type="text"
                  required
                  value={streetLocality}
                  onChange={(e) => setStreetLocality(e.target.value)}
                  placeholder="e.g. Station Road, Post Office Para"
                  className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Shiv Temple / Behind SBI"
                  className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Town / City *
                  </label>
                  <input
                    type="text"
                    required
                    value={cityTown}
                    onChange={(e) => setCityTown(e.target.value)}
                    placeholder="e.g. Barasat"
                    className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="700124"
                    className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 disabled:opacity-60 transition flex items-center justify-center gap-2"
                >
                  {savingAddress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save & Deliver Here"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
