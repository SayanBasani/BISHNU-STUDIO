import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function generateOrderReference(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `BS-${year}${month}-${random}`;
}

export function formatPaymentMethod(method?: string | null): string {
  if (!method || typeof method !== "string" || method.trim() === "") {
    return "Not recorded";
  }
  const normalized = method.toLowerCase().trim();
  switch (normalized) {
    case "cash_on_collection":
      return "Cash on Collection";
    case "cash_on_delivery":
    case "cod":
      return "Cash on Delivery";
    case "upi_mock":
    case "upi":
      return "UPI";
    case "online":
      return "Online Payment";
    case "card":
      return "Card";
    default:
      return normalized
        .split(/[_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

export function getPaymentMethodBadgeClass(method?: string | null): string {
  if (!method || typeof method !== "string") {
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  }
  const normalized = method.toLowerCase().trim();
  switch (normalized) {
    case "cash_on_collection":
    case "cash_on_delivery":
    case "cod":
      return "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900";
    case "upi_mock":
    case "upi":
      return "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900";
    case "online":
    case "card":
      return "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  }
}

