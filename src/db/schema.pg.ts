import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const nowSql = sql`(EXTRACT(epoch FROM now()) * 1000)::bigint`;

// 1. Users
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("customer"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
  avatarUrl: text("avatar_url"),
  passwordUpdatedAt: bigint("password_updated_at", { mode: "number" }),
  status: text("status").notNull().default("active"),
  blockedAt: bigint("blocked_at", { mode: "number" }),
  blockedReason: text("blocked_reason"),
  blockedCategory: text("blocked_category"),
  blockedByAdminId: text("blocked_by_admin_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
});

// 2. User Addresses (Multiple saved addresses - Flipkart/Amazon style)
export const userAddresses = pgTable(
  "user_addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull().default(""),
    recipientPhone: text("recipient_phone").notNull().default(""),
    addressType: text("address_type").notNull().default("home"),
    label: text("label").notNull().default("Home"),
    houseBuilding: text("house_building").notNull(),
    streetLocality: text("street_locality").notNull(),
    landmark: text("landmark"),
    cityTown: text("city_town").notNull(),
    state: text("state").notNull(),
    pinCode: text("pin_code").notNull(),
    isDefault: boolean("is_default").notNull().default(true),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    userIdx: index("idx_user_addresses_user").on(table.userId),
  })
);

// 3. User Sessions
export const sessions = pgTable(
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
    lastActiveAt: bigint("last_active_at", { mode: "number" }),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    tokenIdx: index("idx_sessions_token").on(table.sessionToken),
    userExpiresIdx: index("idx_sessions_user_expires").on(table.userId, table.expiresAt),
  })
);

// 4. Verification Tokens (OTP & Reset Tokens)
export const verificationTokens = pgTable("verification_tokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  tokenHash: text("token_hash").notNull(),
  type: text("type").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 5. Product Categories
export const productCategories = pgTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 6. Products
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => productCategories.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  price: doublePrecision("price").notNull(),
  discountedPrice: doublePrecision("discounted_price"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  sku: text("sku").notNull().unique(),
  variantsJson: text("variants_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
});

// 7. Product Images
export const productImages = pgTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    altText: text("alt_text"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    productIdIdx: index("idx_product_images_product").on(table.productId),
  })
);

// 8. Services (PVC, Document Print, Lamination, Photo Print)
export const services = pgTable("services", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 9. Service Options
export const serviceOptions = pgTable("service_options", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  optionGroup: text("option_group").notNull(),
  optionKey: text("option_key").notNull(),
  optionName: text("option_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  metadataJson: text("metadata_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 10. Service Prices
export const servicePrices = pgTable("service_prices", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  optionId: text("option_id").references(() => serviceOptions.id, {
    onDelete: "cascade",
  }),
  price: doublePrecision("price").notNull(),
  unit: text("unit").notNull(),
  minQuantity: integer("min_quantity").notNull().default(1),
  maxQuantity: integer("max_quantity").notNull().default(1000),
  extraChargesJson: text("extra_charges_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
});

// 11. Orders
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderReference: text("order_reference").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    orderType: text("order_type").notNull(),
    subtotal: doublePrecision("subtotal").notNull(),
    discount: doublePrecision("discount").notNull().default(0),
    additionalCharges: doublePrecision("additional_charges").notNull().default(0),
    totalAmount: doublePrecision("total_amount").notNull(),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    paymentMethod: text("payment_method").notNull().default("cash_on_collection"),
    orderStatus: text("order_status").notNull().default("pending"),
    deliveryType: text("delivery_type").notNull().default("store_pickup"),
    orderNotes: text("order_notes"),
    internalNotes: text("internal_notes"),
    shippingAddressJson: text("shipping_address_json"),
    trackingNumber: text("tracking_number"),
    courierName: text("courier_name"),
    dispatchedAt: bigint("dispatched_at", { mode: "number" }),
    deliveredAt: bigint("delivered_at", { mode: "number" }),
    deliveryPersonName: text("delivery_person_name"),
    deliveryPersonPhone: text("delivery_person_phone"),
    trackingUrl: text("tracking_url"),
    expectedDeliveryDate: text("expected_delivery_date"),
    customerFulfillmentNote: text("customer_fulfillment_note"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("unfulfilled"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    customerCreatedIdx: index("idx_orders_customer_created").on(table.customerId, table.createdAt),
    statusIdx: index("idx_orders_status").on(table.orderStatus),
    refIdx: index("idx_orders_ref").on(table.orderReference),
    createdAtIdx: index("idx_orders_created_at").on(table.createdAt),
  })
);

// 12. Order Items
export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    productId: text("product_id").references(() => products.id),
    serviceId: text("service_id").references(() => services.id),
    configurationJson: text("configuration_json").notNull(),
    quantity: integer("quantity").notNull().default(1),
    pageCount: integer("page_count").notNull().default(1),
    unitPriceSnapshot: doublePrecision("unit_price_snapshot").notNull(),
    totalPriceSnapshot: doublePrecision("total_price_snapshot").notNull(),
    specialInstructions: text("special_instructions"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    orderIdIdx: index("idx_order_items_order").on(table.orderId),
    productIdIdx: index("idx_order_items_product").on(table.productId),
    itemTypeIdx: index("idx_order_items_type").on(table.itemType),
  })
);

// 13. Order Files (Uploaded customer documents, PVC IDs, photos, payment screenshots)
export const orderFiles = pgTable(
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
    fileCategory: text("file_category").notNull(),
    pageCount: integer("page_count"),
    retentionExpiresAt: bigint("retention_expires_at", { mode: "number" }),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    orderIdIdx: index("idx_order_files_order").on(table.orderId),
    orderItemIdIdx: index("idx_order_files_item").on(table.orderItemId),
  })
);

// 14. Payments
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  paymentProvider: text("payment_provider").notNull(),
  transactionReference: text("transaction_reference"),
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull(),
  receivingAccountId: text("receiving_account_id"),
  receivingUpiIdSnapshot: text("receiving_upi_id_snapshot"),
  receivingAccountNameSnapshot: text("receiving_account_name_snapshot"),
  amountVerified: doublePrecision("amount_verified"),
  verifiedByAdminId: text("verified_by_admin_id").references(() => users.id, {
    onDelete: "set null",
  }),
  verifiedAt: bigint("verified_at", { mode: "number" }),
  paymentMetadataJson: text("payment_metadata_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 15. Audit Logs
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    detailsJson: text("details_json"),
    ipAddress: text("ip_address"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    createdAtIdx: index("idx_audit_logs_created").on(table.createdAt),
    userIdx: index("idx_audit_logs_user").on(table.userId),
  })
);

// 16. Authentication Events
export const authenticationEvents = pgTable("authentication_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  email: text("email").notNull(),
  eventType: text("event_type").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").notNull().default("success"),
  failureReason: text("failure_reason"),
  metadataJson: text("metadata_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 17. Shop Settings & UPI Configuration
export const shopSettings = pgTable("shop_settings", {
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
  isOpen: boolean("is_open").notNull().default(true),
  closedMessage: text("closed_message").default(
    "We are currently closed for new orders. Store browsing and existing order tracking remain active."
  ),
  returnPolicyNotice: text("return_policy_notice").default(
    "Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced."
  ),
  returnWindowDays: integer("return_window_days").notNull().default(7),
  customerFulfillmentNote: text("customer_fulfillment_note"),
  upiEnabled: boolean("upi_enabled").notNull().default(true),
  merchantName: text("merchant_name").notNull().default("Bishnu Studio"),
  upiId: text("upi_id").notNull().default("bishnustudio@icici"),
  activeUpiAccountId: text("active_upi_account_id"),
  qrMode: text("qr_mode").notNull().default("generated_upi_id"),
  uploadedQrImageUrl: text("uploaded_qr_image_url"),
  paymentInstructions: text("payment_instructions").default(
    "Pay the exact order amount using the QR code or UPI ID below. After completing your payment in your UPI application, upload your payment screenshot and enter your transaction reference. The shop will verify the payment before confirming your order."
  ),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// 18. Payment Submissions & Manual UPI Verification Attempts
export const paymentSubmissions = pgTable(
  "payment_submissions",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id),
    amount: doublePrecision("amount").notNull(),
    paymentMethod: text("payment_method").notNull().default("upi"),
    upiIdUsed: text("upi_id_used").notNull(),
    receivingAccountId: text("receiving_account_id"),
    receivingUpiIdSnapshot: text("receiving_upi_id_snapshot"),
    receivingAccountNameSnapshot: text("receiving_account_name_snapshot"),
    transactionId: text("transaction_id").notNull(),
    screenshotFileId: text("screenshot_file_id").references(() => orderFiles.id, {
      onDelete: "set null",
    }),
    screenshotUrl: text("screenshot_url"),
    status: text("status").notNull().default("pending_verification"),
    isDuplicateFlagged: boolean("is_duplicate_flagged").notNull().default(false),
    duplicateNotes: text("duplicate_notes"),
    submissionType: text("submission_type").notNull().default("standard"),
    idempotencyKey: text("idempotency_key"),
    rejectionReason: text("rejection_reason"),
    rejectionNote: text("rejection_note"),
    verifiedByAdminId: text("verified_by_admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: bigint("verified_at", { mode: "number" }),
    verificationNote: text("verification_note"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    orderIdIdx: index("idx_payment_submissions_order").on(table.orderId),
  })
);

// 19. Order Status History Timeline
export const orderStatusHistory = pgTable(
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
    actorRole: text("actor_role").notNull().default("system"),
    customerMessage: text("customer_message"),
    internalNote: text("internal_note"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    orderIdIdx: index("idx_order_status_history_order").on(table.orderId),
  })
);

// 20. Account Appeals & Unblock Requests
export const accountAppeals = pgTable("account_appeals", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  category: text("category").notNull().default("mistake"),
  message: text("message").notNull(),
  status: text("status").notNull().default("submitted"),
  adminDecision: text("admin_decision"),
  adminResponseNote: text("admin_response_note"),
  reviewedByAdminId: text("reviewed_by_admin_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  ipAddress: text("ip_address"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
});

// 21. Product Reviews & Customer Ratings
export const productReviews = pgTable(
  "product_reviews",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(),
    reviewTitle: text("review_title"),
    reviewText: text("review_text").notNull(),
    isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
    status: text("status").notNull().default("published"),
    moderationReason: text("moderation_reason"),
    moderatedByAdminId: text("moderated_by_admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: bigint("moderated_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    prodStatusIdx: index("idx_product_reviews_prod_status").on(table.productId, table.status),
    customerProdIdx: index("idx_product_reviews_customer").on(table.customerId, table.productId),
  })
);

// 22. Permanent Receiving UPI Accounts History
export const shopUpiAccounts = pgTable("shop_upi_accounts", {
  id: text("id").primaryKey(),
  upiId: text("upi_id").notNull(),
  accountDisplayName: text("account_display_name").notNull(),
  merchantName: text("merchant_name").notNull().default("Bishnu Studio"),
  qrMode: text("qr_mode").notNull().default("generated_upi_id"),
  uploadedQrImageUrl: text("uploaded_qr_image_url"),
  paymentInstructions: text("payment_instructions"),
  isActive: boolean("is_active").notNull().default(true),
  deactivatedAt: bigint("deactivated_at", { mode: "number" }),
  internalNotes: text("internal_notes"),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
});

// 23. Developer / Author Profile & Credits
export const developerProfile = pgTable("developer_profile", {
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
      "Neon PostgreSQL & Drizzle ORM",
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
  isPublished: boolean("is_published").notNull().default(true),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// 24. Order Returns & Return Requests
export const orderReturns = pgTable("order_returns", {
  id: text("id").primaryKey(), // ret_<uuid>
  returnReference: text("return_reference").notNull().unique(), // e.g. RET-202610-0001
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("requested"),
  reason: text("reason").notNull(),
  customerDescription: text("customer_description").notNull(),
  requestedResolution: text("requested_resolution").notNull().default("refund"),
  evidenceUrlsJson: text("evidence_urls_json"),
  pickupMethod: text("pickup_method").notNull().default("courier_pickup"),
  courierName: text("courier_name"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  deliveryPersonName: text("delivery_person_name"),
  deliveryPersonPhone: text("delivery_person_phone"),
  expectedPickupDate: text("expected_pickup_date"),
  rejectionReason: text("rejection_reason"),
  customerInstructions: text("customer_instructions"),
  internalNotes: text("internal_notes"),
  inspectionResult: text("inspection_result"),
  inspectionNotes: text("inspection_notes"),
  refundAmount: doublePrecision("refund_amount"),
  refundMethod: text("refund_method"),
  refundTransactionReference: text("refund_transaction_reference"),
  refundProcessedAt: bigint("refund_processed_at", { mode: "number" }),
  restocked: boolean("restocked").notNull().default(false),
  restockedAt: bigint("restocked_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
});

// 25. Order Return Items
export const orderReturnItems = pgTable("order_return_items", {
  id: text("id").primaryKey(), // reti_<uuid>
  returnId: text("return_id")
    .notNull()
    .references(() => orderReturns.id, { onDelete: "cascade" }),
  orderItemId: text("order_item_id")
    .notNull()
    .references(() => orderItems.id),
  productId: text("product_id").references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPriceSnapshot: doublePrecision("unit_price_snapshot").notNull(),
  totalPriceSnapshot: doublePrecision("total_price_snapshot").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
});

// 26. Notifications
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(), // notif_<uuid>
    recipientType: text("recipient_type").notNull(), // 'admin' | 'customer'
    recipientId: text("recipient_id").references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull().default("system"), // order, payment, delivery, return, account, system
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: text("entity_type"), // order, payment, return, user, system
    entityId: text("entity_id"),
    linkUrl: text("link_url"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: bigint("read_at", { mode: "number" }),
    priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
    deduplicationKey: text("deduplication_key"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().default(nowSql),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(nowSql),
  },
  (table) => ({
    recipientIdx: index("idx_notifications_recipient").on(table.recipientType, table.recipientId, table.isRead, table.createdAt),
    dedupIdx: index("idx_notifications_dedup").on(table.deduplicationKey),
  })
);

