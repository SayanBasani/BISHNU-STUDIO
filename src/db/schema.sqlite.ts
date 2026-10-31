import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// 1. Users
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["customer", "admin", "staff"] })
    .notNull()
    .default("customer"),
  isEmailVerified: integer("is_email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  isPhoneVerified: integer("is_phone_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  avatarUrl: text("avatar_url"),
  passwordUpdatedAt: integer("password_updated_at"),
  status: text("status", { enum: ["active", "blocked"] })
    .notNull()
    .default("active"),
  blockedAt: integer("blocked_at"),
  blockedReason: text("blocked_reason"),
  blockedCategory: text("blocked_category"),
  blockedByAdminId: text("blocked_by_admin_id"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});



// 2. User Addresses (Multiple saved addresses - Flipkart/Amazon style)
export const userAddresses = sqliteTable(
  "user_addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull().default(""),
    recipientPhone: text("recipient_phone").notNull().default(""),
    addressType: text("address_type", { enum: ["home", "work", "other"] })
      .notNull()
      .default("home"),
    label: text("label").notNull().default("Home"),
    houseBuilding: text("house_building").notNull(),
    streetLocality: text("street_locality").notNull(),
    landmark: text("landmark"),
    cityTown: text("city_town").notNull(),
    state: text("state").notNull(),
    pinCode: text("pin_code").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    userIdx: index("idx_user_addresses_user").on(table.userId),
  })
);

// 3. User Sessions
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull().unique(),
    credentialVersion: text("credential_version"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    lastActiveAt: integer("last_active_at"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    tokenIdx: index("idx_sessions_token").on(table.sessionToken),
    userExpiresIdx: index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
  })
);

// 4. Verification Tokens (OTP & Reset Tokens)
export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(), // Email or Phone number
  tokenHash: text("token_hash").notNull(),
  type: text("type", {
    enum: ["email_verify", "phone_otp", "password_reset"],
  }).notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 5. Product Categories
export const productCategories = sqliteTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 6. Products
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => productCategories.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  discountedPrice: real("discounted_price"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  isAvailable: integer("is_available", { mode: "boolean" })
    .notNull()
    .default(true),
  sku: text("sku").notNull().unique(),
  variantsJson: text("variants_json"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});



// 7. Product Images
export const productImages = sqliteTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    altText: text("alt_text"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    productIdIdx: index("idx_product_images_product").on(table.productId),
  })
);

// 8. Services (PVC, Document Print, Lamination, Photo Print)
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(), // 'pvc_card', 'document_print', 'lamination', 'photo_print'
  name: text("name").notNull(),
  description: text("description").notNull(),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 9. Service Options
export const serviceOptions = sqliteTable("service_options", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  optionGroup: text("option_group").notNull(), // 'document_type', 'paper_size', 'photo_size', etc.
  optionKey: text("option_key").notNull(), // 'aadhaar', 'pan', 'dl', 'a4', 'passport', etc.
  optionName: text("option_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  metadataJson: text("metadata_json"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 10. Service Prices
export const servicePrices = sqliteTable("service_prices", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  optionId: text("option_id").references(() => serviceOptions.id, {
    onDelete: "cascade",
  }),
  price: real("price").notNull(), // in INR
  unit: text("unit").notNull(), // 'per_card', 'per_page', 'per_sheet', 'per_photo'
  minQuantity: integer("min_quantity").notNull().default(1),
  maxQuantity: integer("max_quantity").notNull().default(1000),
  extraChargesJson: text("extra_charges_json"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});



// 11. Orders
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderReference: text("order_reference").notNull().unique(), // e.g. BS-202610-0001
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    orderType: text("order_type", {
      enum: ["shopping", "print_service", "hybrid"],
    }).notNull(),
    subtotal: real("subtotal").notNull(),
    discount: real("discount").notNull().default(0),
    additionalCharges: real("additional_charges").notNull().default(0),
    totalAmount: real("total_amount").notNull(),
    paymentStatus: text("payment_status", {
      enum: [
        "unpaid",
        "awaiting_payment",
        "payment_initiated",
        "pending_verification",
        "paid",
        "rejected",
        "failed",
        "refunded",
        "review_required",
        "pending",
      ],
    })
      .notNull()
      .default("unpaid"),
    paymentMethod: text("payment_method", {
      enum: ["cash_on_collection", "upi_mock", "online"],
    })
      .notNull()
      .default("cash_on_collection"),
    orderStatus: text("order_status", {
      enum: [
        "pending",
        "confirmed",
        "processing",
        "ready_for_collection",
        "out_for_delivery",
        "completed",
        "cancelled",
      ],
    })
      .notNull()
      .default("pending"),
    deliveryType: text("delivery_type", {
      enum: ["store_pickup", "home_delivery"],
    })
      .notNull()
      .default("store_pickup"),
    orderNotes: text("order_notes"),
    internalNotes: text("internal_notes"),
    shippingAddressJson: text("shipping_address_json"),
    trackingNumber: text("tracking_number"),
    courierName: text("courier_name"),
    dispatchedAt: integer("dispatched_at"),
    deliveredAt: integer("delivered_at"),
    deliveryPersonName: text("delivery_person_name"),
    deliveryPersonPhone: text("delivery_person_phone"),
    trackingUrl: text("tracking_url"),
    expectedDeliveryDate: text("expected_delivery_date"),
    customerFulfillmentNote: text("customer_fulfillment_note"),
    fulfillmentStatus: text("fulfillment_status", {
      enum: [
        "unfulfilled",
        "preparing",
        "ready_for_pickup",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed_delivery",
      ],
    })
      .notNull()
      .default("unfulfilled"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    customerCreatedIdx: index("idx_orders_customer_created").on(table.customerId, table.createdAt),
    statusIdx: index("idx_orders_status").on(table.orderStatus),
    refIdx: index("idx_orders_ref").on(table.orderReference),
    createdAtIdx: index("idx_orders_created_at").on(table.createdAt),
  })
);

// 12. Order Items
export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemType: text("item_type", {
      enum: [
        "product",
        "pvc_card",
        "document_print",
        "lamination",
        "photo_print",
      ],
    }).notNull(),
    productId: text("product_id").references(() => products.id),
    serviceId: text("service_id").references(() => services.id),
    configurationJson: text("configuration_json").notNull(),
    quantity: integer("quantity").notNull().default(1),
    pageCount: integer("page_count").notNull().default(1),
    unitPriceSnapshot: real("unit_price_snapshot").notNull(),
    totalPriceSnapshot: real("total_price_snapshot").notNull(),
    specialInstructions: text("special_instructions"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    orderIdIdx: index("idx_order_items_order").on(table.orderId),
    productIdIdx: index("idx_order_items_product").on(table.productId),
    itemTypeIdx: index("idx_order_items_type").on(table.itemType),
  })
);

// 13. Order Files (Uploaded customer documents, PVC IDs, photos, payment screenshots)
export const orderFiles = sqliteTable(
  "order_files",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    orderItemId: text("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    originalFilename: text("original_filename").notNull(),
    storedFilename: text("stored_filename").notNull(),
    storageKey: text("storage_key").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    fileCategory: text("file_category", {
      enum: [
        "pvc_document",
        "general_document",
        "photo",
        "product_image",
        "payment_proof",
        "profile_picture",
      ],
    }).notNull(),
    pageCount: integer("page_count"),
    retentionExpiresAt: integer("retention_expires_at"),
    isDeleted: integer("is_deleted", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    orderIdIdx: index("idx_order_files_order").on(table.orderId),
    orderItemIdIdx: index("idx_order_files_item").on(table.orderItemId),
  })
);

// 14. Payments
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  paymentProvider: text("payment_provider", {
    enum: ["cash", "upi", "razorpay_mock"],
  }).notNull(),
  transactionReference: text("transaction_reference"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status", {
    enum: ["pending", "successful", "failed", "refunded", "review_required"],
  }).notNull(),
  // Receiving account snapshot (immutable permanent record)
  receivingAccountId: text("receiving_account_id"),
  receivingUpiIdSnapshot: text("receiving_upi_id_snapshot"),
  receivingAccountNameSnapshot: text("receiving_account_name_snapshot"),
  amountVerified: real("amount_verified"),
  verifiedByAdminId: text("verified_by_admin_id").references(() => users.id, {
    onDelete: "set null",
  }),
  verifiedAt: integer("verified_at"),
  paymentMetadataJson: text("payment_metadata_json"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 15. Audit Logs
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type", {
      enum: [
        "order",
        "product",
        "pricing",
        "user",
        "file",
        "auth",
        "settings",
        "payment",
        "account_appeal",
        "product_review",
        "upi_account",
        "developer_profile",
      ],
    }).notNull(),
    entityId: text("entity_id"),
    detailsJson: text("details_json"),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    createdAtIdx: index("idx_audit_logs_created").on(table.createdAt),
    userIdx: index("idx_audit_logs_user").on(table.userId),
  })
);

// 16. Authentication Events
export const authenticationEvents = sqliteTable("authentication_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  email: text("email").notNull(),
  eventType: text("event_type", {
    enum: [
      "login_success",
      "login_failure",
      "logout",
      "admin_login_success",
      "admin_login_failure",
      "password_reset_request",
      "password_reset_complete",
    ],
  }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status", { enum: ["success", "failure"] })
    .notNull()
    .default("success"),
  failureReason: text("failure_reason"),
  metadataJson: text("metadata_json"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 17. Shop Settings & UPI Configuration
export const shopSettings = sqliteTable("shop_settings", {
  id: text("id").primaryKey(), // "default"
  shopName: text("shop_name").notNull().default("Bishnu Studio"),
  building: text("building").notNull().default("12/B Station Road"),
  street: text("street").notNull().default("Main Market"),
  landmark: text("landmark").default("Near Town Hall & Central Post Office"),
  cityTown: text("city_town").notNull().default("Barasat"),
  state: text("state").notNull().default("West Bengal"),
  pinCode: text("pin_code").notNull().default("700001"),
  contactPhone: text("contact_phone").notNull().default("9876543210"),
  contactEmail: text("contact_email").notNull().default("support@bishnustudio.com"),
  openingHours: text("opening_hours").default("Mon-Sat 8:00 AM - 9:30 PM, Sun 10:00 AM - 4:00 PM"),
  logoUrl: text("logo_url"),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
  closedMessage: text("closed_message").default(
    "We are currently closed for new orders. Store browsing and existing order tracking remain active."
  ),
  returnPolicyNotice: text("return_policy_notice").default(
    "Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced."
  ),
  returnWindowDays: integer("return_window_days").notNull().default(7),
  customerFulfillmentNote: text("customer_fulfillment_note"),
  // UPI configuration
  upiEnabled: integer("upi_enabled", { mode: "boolean" }).notNull().default(true),
  merchantName: text("merchant_name").notNull().default("Bishnu Studio"),
  upiId: text("upi_id").notNull().default("bishnustudio@icici"),
  activeUpiAccountId: text("active_upi_account_id"),
  qrMode: text("qr_mode", { enum: ["uploaded_image", "generated_upi_id"] })
    .notNull()
    .default("generated_upi_id"),
  uploadedQrImageUrl: text("uploaded_qr_image_url"),
  paymentInstructions: text("payment_instructions").default(
    "Pay the exact order amount using the QR code or UPI ID below. After completing your payment in your UPI application, upload your payment screenshot and enter your transaction reference. The shop will verify the payment before confirming your order."
  ),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// 18. Payment Submissions & Manual UPI Verification Attempts
export const paymentSubmissions = sqliteTable(
  "payment_submissions",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    amount: real("amount").notNull(),
    paymentMethod: text("payment_method").notNull().default("upi"),
    upiIdUsed: text("upi_id_used").notNull(),
    // Permanent receiving account snapshot (immutable permanent record)
    receivingAccountId: text("receiving_account_id"),
    receivingUpiIdSnapshot: text("receiving_upi_id_snapshot"),
    receivingAccountNameSnapshot: text("receiving_account_name_snapshot"),
    transactionId: text("transaction_id").notNull(), // UTR / reference number
    screenshotFileId: text("screenshot_file_id").references(() => orderFiles.id, {
      onDelete: "set null",
    }),
    screenshotUrl: text("screenshot_url"),
    status: text("status", {
      enum: [
        "pending_verification",
        "verified",
        "rejected",
        "expired",
        "review_required",
      ],
    })
      .notNull()
      .default("pending_verification"),
    isDuplicateFlagged: integer("is_duplicate_flagged", { mode: "boolean" })
      .notNull()
      .default(false),
    duplicateNotes: text("duplicate_notes"),
    submissionType: text("submission_type", {
      enum: ["standard", "post_cancellation_claim"],
    })
      .notNull()
      .default("standard"),
    idempotencyKey: text("idempotency_key"),
    rejectionReason: text("rejection_reason"),
    rejectionNote: text("rejection_note"),
    verifiedByAdminId: text("verified_by_admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: integer("verified_at"),
    verificationNote: text("verification_note"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    orderIdIdx: index("idx_payment_submissions_order").on(table.orderId),
  })
);

// 19. Order Status History Timeline
export const orderStatusHistory = sqliteTable(
  "order_status_history",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    previousPaymentStatus: text("previous_payment_status"),
    newPaymentStatus: text("new_payment_status"),
    changedByUserId: text("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role", { enum: ["customer", "admin", "system"] })
      .notNull()
      .default("system"),
    customerMessage: text("customer_message"),
    internalNote: text("internal_note"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    orderIdIdx: index("idx_order_status_history_order").on(table.orderId),
  })
);

// 20. Account Appeals & Unblock Requests
export const accountAppeals = sqliteTable("account_appeals", {
  id: text("id").primaryKey(), // app_<uuid>
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  category: text("category", {
    enum: [
      "mistake",
      "fraud_clarification",
      "compromised_account",
      "policy_query",
      "spam",
      "abusive",
      "fraud",
      "misuse",
      "other",
    ],
  })
    .notNull()
    .default("mistake"),
  message: text("message").notNull(),
  status: text("status", {
    enum: ["submitted", "under_review", "approved", "rejected", "closed"],
  })
    .notNull()
    .default("submitted"),
  adminDecision: text("admin_decision"),
  adminResponseNote: text("admin_response_note"),
  reviewedByAdminId: text("reviewed_by_admin_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: integer("reviewed_at"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});



// 21. Product Reviews & Customer Ratings
export const productReviews = sqliteTable(
  "product_reviews",
  {
    id: text("id").primaryKey(), // rev_<uuid>
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(), // 1 - 5
    reviewTitle: text("review_title"),
    reviewText: text("review_text").notNull(),
    isVerifiedPurchase: integer("is_verified_purchase", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", {
      enum: ["published", "hidden", "under_review"],
    })
      .notNull()
      .default("published"),
    moderationReason: text("moderation_reason"),
    moderatedByAdminId: text("moderated_by_admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: integer("moderated_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    prodStatusIdx: index("idx_product_reviews_prod_status").on(table.productId, table.status),
    customerProdIdx: index("idx_product_reviews_customer").on(table.customerId, table.productId),
  })
);

// 22. Permanent Receiving UPI Accounts History
export const shopUpiAccounts = sqliteTable("shop_upi_accounts", {
  id: text("id").primaryKey(), // acc_upi_<uuid>
  upiId: text("upi_id").notNull(),
  accountDisplayName: text("account_display_name").notNull(),
  merchantName: text("merchant_name").notNull().default("Bishnu Studio"),
  qrMode: text("qr_mode", { enum: ["uploaded_image", "generated_upi_id"] })
    .notNull()
    .default("generated_upi_id"),
  uploadedQrImageUrl: text("uploaded_qr_image_url"),
  paymentInstructions: text("payment_instructions"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  deactivatedAt: integer("deactivated_at"),
  internalNotes: text("internal_notes"),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 23. Developer / Author Profile & Credits
export const developerProfile = sqliteTable("developer_profile", {
  id: text("id").primaryKey(), // "default"
  developerName: text("developer_name").notNull().default("Sayan (Antigravity Engineer)"),
  professionalTitle: text("professional_title")
    .notNull()
    .default("Senior Full-Stack Engineer & Solutions Architect"),
  biography: text("biography").notNull().default(
    "Full-stack software engineer specializing in high-reliability e-commerce architectures, automated print pipelines, resilient payment workflows, and accessible responsive interfaces."
  ),
  skillsJson: text("skills_json").default(
    JSON.stringify([
      "Next.js 14 (App Router)",
      "TypeScript",
      "Tailwind CSS",
      "Drizzle ORM & LibSQL",
      "UPI Payment Workflows",
      "Serverless Architecture",
      "REST & Edge APIs",
      "PDF & Image Processing",
    ])
  ),
  projectContribution: text("project_contribution").default(
    "Architected and implemented Bishnu Studio end-to-end: secure document upload pipelines, server-side dynamic pricing calculation, manual UPI reconciliation engine, verified product reviews, customer management with appeal processing, and full dark/light theme consistency."
  ),
  projectStartDate: text("project_start_date").default("2024-01-15"),
  projectCompletionDate: text("project_completion_date").default("2024-10-25"),
  portfolioUrl: text("portfolio_url"),
  githubUrl: text("github_url").default("https://github.com"),
  linkedinUrl: text("linkedin_url").default("https://linkedin.com"),
  contactEmail: text("contact_email").default("developer@bishnustudio.com"),
  avatarUrl: text("avatar_url"),
  creditsStatement: text("credits_statement").default(
    "Website developed and maintained by Sayan (Antigravity Engineer) for Bishnu Studio. All rights reserved."
  ),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// 24. Order Returns & Return Requests
export const orderReturns = sqliteTable("order_returns", {
  id: text("id").primaryKey(), // ret_<uuid>
  returnReference: text("return_reference").notNull().unique(), // e.g. RET-202610-0001
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id")
    .notNull()
    .references(() => users.id),
  status: text("status", {
    enum: [
      "requested",
      "under_review",
      "approved",
      "rejected",
      "pickup_scheduled",
      "in_transit",
      "received",
      "inspection_in_progress",
      "refund_pending",
      "refund_processed",
      "exchange_processing",
      "completed",
      "cancelled",
    ],
  })
    .notNull()
    .default("requested"),
  reason: text("reason", {
    enum: [
      "damaged",
      "wrong_item",
      "defective",
      "print_specification_mismatch",
      "missing_parts",
      "other",
    ],
  }).notNull(),
  customerDescription: text("customer_description").notNull(),
  requestedResolution: text("requested_resolution", {
    enum: ["refund", "exchange"],
  })
    .notNull()
    .default("refund"),
  evidenceUrlsJson: text("evidence_urls_json"),
  pickupMethod: text("pickup_method", {
    enum: ["courier_pickup", "counter_dropoff"],
  })
    .notNull()
    .default("courier_pickup"),
  courierName: text("courier_name"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  deliveryPersonName: text("delivery_person_name"),
  deliveryPersonPhone: text("delivery_person_phone"),
  expectedPickupDate: text("expected_pickup_date"),
  rejectionReason: text("rejection_reason"),
  customerInstructions: text("customer_instructions"),
  internalNotes: text("internal_notes"),
  inspectionResult: text("inspection_result", {
    enum: ["passed", "failed", "partial", "pending"],
  }),
  inspectionNotes: text("inspection_notes"),
  refundAmount: real("refund_amount"),
  refundMethod: text("refund_method", {
    enum: ["upi", "bank_transfer", "cash"],
  }),
  refundTransactionReference: text("refund_transaction_reference"),
  refundProcessedAt: integer("refund_processed_at"),
  restocked: integer("restocked", { mode: "boolean" }).notNull().default(false),
  restockedAt: integer("restocked_at"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 25. Order Return Items
export const orderReturnItems = sqliteTable("order_return_items", {
  id: text("id").primaryKey(), // reti_<uuid>
  returnId: text("return_id")
    .notNull()
    .references(() => orderReturns.id, { onDelete: "cascade" }),
  orderItemId: text("order_item_id")
    .notNull()
    .references(() => orderItems.id),
  productId: text("product_id").references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPriceSnapshot: real("unit_price_snapshot").notNull(),
  totalPriceSnapshot: real("total_price_snapshot").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// 26. Notifications
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(), // notif_<uuid>
    recipientType: text("recipient_type", { enum: ["admin", "customer"] }).notNull(),
    recipientId: text("recipient_id").references(() => users.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["order", "payment", "delivery", "return", "account", "system"],
    })
      .notNull()
      .default("system"),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: text("entity_type", {
      enum: ["order", "payment", "return", "user", "setting", "system"],
    }),
    entityId: text("entity_id"),
    linkUrl: text("link_url"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    readAt: integer("read_at"),
    priority: text("priority", { enum: ["low", "normal", "high", "urgent"] })
      .notNull()
      .default("normal"),
    deduplicationKey: text("deduplication_key"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    recipientIdx: index("idx_notifications_recipient").on(table.recipientType, table.recipientId, table.isRead, table.createdAt),
    dedupIdx: index("idx_notifications_dedup").on(table.deduplicationKey),
  })
);



