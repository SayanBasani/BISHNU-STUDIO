export type UserRole = "customer" | "admin" | "staff";

export type ServiceKey = "pvc_card" | "document_print" | "lamination" | "photo_print";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "ready_for_collection"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed";

export type PaymentMethod = "cash_on_collection" | "upi_mock" | "online";

export type DeliveryType = "store_pickup" | "home_delivery";

export interface CartItem {
  id: string; // client temporary item id
  itemType: "product" | "pvc_card" | "document_print" | "lamination" | "photo_print";
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productId?: string;
  serviceId?: string;
  fileIds?: string[];
  // Specific service configurations
  configuration: {
    // PVC Card
    documentType?: string;
    documentNumber?: string;
    // Document Print
    printMode?: "bw" | "color" | string;
    paperSize?: "A4" | "Legal" | "A3" | string;
    sides?: "single" | "double" | string;
    pageCount?: number;
    includeLamination?: boolean;
    // Lamination
    laminationSize?: string;
    thicknessFinish?: string;
    sheets?: number;
    // Photo Print
    photoSize?: string;
    photoFinish?: "glossy" | "matte" | string;
    copies?: number;
    imageCount?: number;
    uploadedFiles?: Array<{
      fileId: string;
      originalName: string;
      fileSize: number;
      mimeType: string;
      copies?: number;
      previewUrl?: string;
    }>;
    specialInstructions?: string;
  };
}

export interface DynamicPricingConfig {
  pvcCardBasePrice: number;
  documentPrintRates: {
    [paperSize: string]: {
      bw: { single: number; double: number };
      color: { single: number; double: number };
    };
  };
  laminationRates: {
    [size: string]: {
      glossy_standard: number;
      matte_premium: number;
    };
  };
  photoPrintRates: {
    [photoSize: string]: {
      glossy: number;
      matte: number;
    };
  };
}
