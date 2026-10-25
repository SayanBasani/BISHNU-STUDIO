import { db } from "./index";
import {
  users,
  productCategories,
  products,
  productImages,
  services,
  serviceOptions,
  servicePrices,
} from "./schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function seed() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    console.warn("Seeding demo data is disabled in production environment.");
    return;
  }
  console.log("Starting Bishnu Studio database seeding...");

  // 1. Seed Users (Admin & Customer)
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@Bishnu2026!";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const customerHash = await bcrypt.hash("Customer@12345!", 10);

  const adminId = "usr_admin_001";
  const customerId = "usr_cust_001";

  await db
    .insert(users)
    .values([
      {
        id: adminId,
        fullName: process.env.ADMIN_NAME || "Bishnu Studio Admin",
        email: (process.env.ADMIN_EMAIL || "admin@bishnustudio.com").toLowerCase(),
        phone: process.env.ADMIN_PHONE || "9876543210",
        passwordHash: adminHash,
        role: "admin",
        isEmailVerified: true,
        isPhoneVerified: true,
      },
      {
        id: customerId,
        fullName: "Rahul Sen Sharma",
        email: "customer@example.com",
        phone: "9876543211",
        passwordHash: customerHash,
        role: "customer",
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    ])
    .onConflictDoNothing();

  console.log("Users seeded.");

  // 2. Product Categories
  const categoriesData = [
    {
      id: "cat_stat_01",
      name: "Paper & Printing Supplies",
      slug: "paper-and-printing-supplies",
      description: "Copier paper reams, bond paper, photographic paper rolls & sheets",
      sortOrder: 1,
    },
    {
      id: "cat_stat_02",
      name: "Office & School Stationery",
      slug: "office-school-stationery",
      description: "Registers, notebooks, pens, markers, file folders and desktop accessories",
      sortOrder: 2,
    },
    {
      id: "cat_stat_03",
      name: "Desk Tools & Binding",
      slug: "desk-tools-binding",
      description: "Heavy duty staplers, punching machines, paper cutters, adhesives and files",
      sortOrder: 3,
    },
    {
      id: "cat_stat_04",
      name: "Computer & Tech Accessories",
      slug: "computer-tech-accessories",
      description: "USB pendrives, OTG cables, mouse, card readers and printer cables",
      sortOrder: 4,
    },
  ];

  for (const cat of categoriesData) {
    await db.insert(productCategories).values(cat).onConflictDoNothing();
  }
  console.log("Product categories seeded.");

  // 3. Products
  const productsData = [
    {
      id: "prod_01",
      categoryId: "cat_stat_01",
      name: "JK Copier A4 Paper Ream (75 GSM, 500 Sheets)",
      slug: "jk-copier-a4-75gsm-500-sheets",
      description:
        "High-grade multi-purpose paper suited for everyday copying, laser printing, inkjet printing and high-speed photocopying. Acid-free bright white sheets.",
      price: 360,
      discountedPrice: 340,
      stockQuantity: 150,
      isAvailable: true,
      sku: "JK-A4-75GSM",
      images: [
        "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_02",
      categoryId: "cat_stat_01",
      name: "Kodak Premium High-Gloss Photo Paper A4 (20 Sheets, 210 GSM)",
      slug: "kodak-premium-high-gloss-photo-paper-a4",
      description:
        "Waterproof resin-coated photographic paper for crisp, vivid, true-to-life studio photo prints. Fast drying and smudge resistant.",
      price: 320,
      discountedPrice: 280,
      stockQuantity: 60,
      isAvailable: true,
      sku: "KDK-PHOTO-A4-210",
      images: [
        "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_03",
      categoryId: "cat_stat_02",
      name: "Classmate Pulse Spiral Long Notebook (Rule, 300 Pages)",
      slug: "classmate-pulse-spiral-long-notebook",
      description:
        "Premium quality elemental chlorine-free paper notebook with sturdy polypropylene cover and twin wire-bound spiral spine. Ideal for college and office notes.",
      price: 130,
      discountedPrice: 110,
      stockQuantity: 85,
      isAvailable: true,
      sku: "CLS-SPIRAL-300",
      images: [
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_04",
      categoryId: "cat_stat_02",
      name: "Reynolds 045 Fine Carbure Ball Pen (Pack of 10, Blue)",
      slug: "reynolds-045-fine-ball-pen-pack-10",
      description:
        "India's iconic reliable ball pen with 0.7 mm tip for smooth non-stop handwriting. Laser tip precision.",
      price: 100,
      discountedPrice: 85,
      stockQuantity: 120,
      isAvailable: true,
      sku: "REY-045-BLU-10",
      images: [
        "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_05",
      categoryId: "cat_stat_03",
      name: "Kangaro HD-10 Heavy Duty Desk Stapler with 1000 Pins",
      slug: "kangaro-hd-10-desk-stapler-with-pins",
      description:
        "All-metal construction with high impact plastic casing. Quick reload mechanism. Capable of binding up to 30 sheets effortlessly.",
      price: 210,
      discountedPrice: 180,
      stockQuantity: 40,
      isAvailable: true,
      sku: "KNG-HD10-STP",
      images: [
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_06",
      categoryId: "cat_stat_03",
      name: "Camlin Kokuyo Acrylic Exam Writing Board / Clip Board",
      slug: "camlin-kokuyo-acrylic-exam-clipboard",
      description:
        "Durable, shatterproof transparent acrylic writing clipboard with chrome-plated heavy grip clamp and ruled metric edge.",
      price: 165,
      discountedPrice: 145,
      stockQuantity: 50,
      isAvailable: true,
      sku: "CAM-CLIPBD-ACR",
      images: [
        "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_07",
      categoryId: "cat_stat_04",
      name: "SanDisk 64GB Ultra Dual USB 3.0 Flash Drive (Type-A & Micro-USB)",
      slug: "sandisk-64gb-ultra-dual-drive-usb-30",
      description:
        "High-speed USB 3.0 performance up to 130MB/s file transfer. Dual connectors allow quick movement of photos and documents between smartphones, PCs and Macs.",
      price: 699,
      discountedPrice: 549,
      stockQuantity: 35,
      isAvailable: true,
      sku: "SND-DUAL-64GB",
      images: [
        "https://images.unsplash.com/photo-1624823183493-5f06121f1589?auto=format&fit=crop&w=600&q=80",
      ],
    },
    {
      id: "prod_08",
      categoryId: "cat_stat_04",
      name: "HP Optical USB Wired Ergonomic Mouse (1000 DPI)",
      slug: "hp-optical-usb-wired-ergonomic-mouse",
      description:
        "Smooth optical tracking with 1000 DPI sensor, contoured ambidextrous shape, non-slip scroll wheel, and durable 1.5m USB cable.",
      price: 499,
      discountedPrice: 389,
      stockQuantity: 25,
      isAvailable: true,
      sku: "HP-MOUSE-OPT100",
      images: [
        "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80",
      ],
    },
  ];

  for (const item of productsData) {
    const { images, ...productRecord } = item;
    await db.insert(products).values(productRecord).onConflictDoNothing();

    // Insert Product Images
    for (let i = 0; i < images.length; i++) {
      await db
        .insert(productImages)
        .values({
          id: `img_${item.id}_${i}`,
          productId: item.id,
          imageUrl: images[i],
          altText: item.name,
          isPrimary: i === 0,
          sortOrder: i,
        })
        .onConflictDoNothing();
    }
  }
  console.log("Products and images seeded.");

  // 4. Services Configuration
  const servicesData = [
    {
      id: "srv_pvc",
      key: "pvc_card",
      name: "PVC Card Printing",
      description:
        "Durable, waterproof, credit-card thickness (0.76mm) PVC smart printing for identity documents, Aadhaar, PAN, Voter ID and licences.",
      isActive: true,
    },
    {
      id: "srv_doc",
      key: "document_print",
      name: "Document Printing",
      description:
        "High-definition laser and inkjet printing for legal drafts, office reports, academic notes, resumes and brochures.",
      isActive: true,
    },
    {
      id: "srv_lam",
      key: "lamination",
      name: "Document Lamination",
      description:
        "Thermal sealed glossy and matte pouch lamination to protect certificates, legal agreements, cards and diplomas from moisture and wear.",
      isActive: true,
    },
    {
      id: "srv_photo",
      key: "photo_print",
      name: "Photo Printing Studio",
      description:
        "Lab-quality high gloss and matte portrait photo prints, visa/passport photographs, and framed wall size photo enlargements.",
      isActive: true,
    },
  ];

  for (const srv of servicesData) {
    await db.insert(services).values(srv).onConflictDoNothing();
  }
  console.log("Services seeded.");

  // 5. Service Options & Service Prices
  // 5.1 PVC Options
  const pvcDocTypes = [
    { key: "aadhaar", name: "Aadhaar Card", price: 50 },
    { key: "pan", name: "PAN Card", price: 50 },
    { key: "dl", name: "Driving Licence", price: 60 },
    { key: "voter", name: "Voter ID Card", price: 50 },
    { key: "ration", name: "Ration Card", price: 50 },
    { key: "other", name: "Other ID / Member Card", price: 60 },
  ];

  for (const doc of pvcDocTypes) {
    const optId = `opt_pvc_${doc.key}`;
    await db
      .insert(serviceOptions)
      .values({
        id: optId,
        serviceId: "srv_pvc",
        optionGroup: "document_type",
        optionKey: doc.key,
        optionName: doc.name,
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(servicePrices)
      .values({
        id: `prc_pvc_${doc.key}`,
        serviceId: "srv_pvc",
        optionId: optId,
        price: doc.price,
        unit: "per_card",
        minQuantity: 1,
        maxQuantity: 100,
      })
      .onConflictDoNothing();
  }

  // 5.2 Document Printing Options & Prices
  // Paper sizes: A4, Legal, A3
  const docSizes = [
    { key: "A4", name: "A4 Size (210 x 297 mm)" },
    { key: "Legal", name: "Legal Size (216 x 356 mm)" },
    { key: "A3", name: "A3 Poster Size (297 x 420 mm)" },
  ];

  for (const s of docSizes) {
    const optId = `opt_doc_size_${s.key.toLowerCase()}`;
    await db
      .insert(serviceOptions)
      .values({
        id: optId,
        serviceId: "srv_doc",
        optionGroup: "paper_size",
        optionKey: s.key,
        optionName: s.name,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  // Document Printing Rate Matrix in INR
  const docRateMatrix = [
    { key: "a4_bw_single", name: "A4 B&W Single-Sided", price: 3.0, unit: "per_page" },
    { key: "a4_bw_double", name: "A4 B&W Double-Sided (Back to Back)", price: 2.5, unit: "per_side" },
    { key: "a4_col_single", name: "A4 Colour Single-Sided", price: 10.0, unit: "per_page" },
    { key: "a4_col_double", name: "A4 Colour Double-Sided", price: 8.0, unit: "per_side" },
    { key: "legal_bw_single", name: "Legal B&W Single-Sided", price: 4.0, unit: "per_page" },
    { key: "legal_bw_double", name: "Legal B&W Double-Sided", price: 3.5, unit: "per_side" },
    { key: "legal_col_single", name: "Legal Colour Single-Sided", price: 12.0, unit: "per_page" },
    { key: "legal_col_double", name: "Legal Colour Double-Sided", price: 10.0, unit: "per_side" },
    { key: "a3_bw_single", name: "A3 B&W Single-Sided", price: 10.0, unit: "per_page" },
    { key: "a3_col_single", name: "A3 Colour Single-Sided", price: 25.0, unit: "per_page" },
  ];

  for (const r of docRateMatrix) {
    const optId = `opt_doc_mode_${r.key}`;
    await db
      .insert(serviceOptions)
      .values({
        id: optId,
        serviceId: "srv_doc",
        optionGroup: "print_mode_rate",
        optionKey: r.key,
        optionName: r.name,
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(servicePrices)
      .values({
        id: `prc_doc_${r.key}`,
        serviceId: "srv_doc",
        optionId: optId,
        price: r.price,
        unit: r.unit,
        minQuantity: 1,
        maxQuantity: 5000,
      })
      .onConflictDoNothing();
  }

  // 5.3 Lamination Options & Prices
  const lamOptions = [
    { key: "id_card", name: "ID Card / PVC Size Lamination", price: 10, unit: "per_sheet" },
    { key: "a4_glossy", name: "A4 Thermal Lamination (Glossy 125 Micron)", price: 20, unit: "per_sheet" },
    { key: "a4_matte", name: "A4 Premium Matte Lamination (Anti-glare)", price: 35, unit: "per_sheet" },
    { key: "legal_glossy", name: "Legal Size Lamination (Glossy)", price: 25, unit: "per_sheet" },
    { key: "a3_glossy", name: "A3 Heavy Duty Lamination", price: 50, unit: "per_sheet" },
  ];

  for (const lam of lamOptions) {
    const optId = `opt_lam_${lam.key}`;
    await db
      .insert(serviceOptions)
      .values({
        id: optId,
        serviceId: "srv_lam",
        optionGroup: "lamination_size",
        optionKey: lam.key,
        optionName: lam.name,
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(servicePrices)
      .values({
        id: `prc_lam_${lam.key}`,
        serviceId: "srv_lam",
        optionId: optId,
        price: lam.price,
        unit: lam.unit,
        minQuantity: 1,
        maxQuantity: 1000,
      })
      .onConflictDoNothing();
  }

  // 5.4 Photo Printing Options & Prices
  const photoSizes = [
    {
      key: "passport",
      name: "Passport Size Set (8 Photographs, 35 x 45 mm)",
      price: 50,
      metadata: JSON.stringify({ widthMm: 35, heightMm: 45, countPerSheet: 8 }),
    },
    {
      key: "stamp_size",
      name: "Stamp Size Set (16 Photographs, 25 x 30 mm)",
      price: 50,
      metadata: JSON.stringify({ widthMm: 25, heightMm: 30, countPerSheet: 16 }),
    },
    {
      key: "4x6",
      name: '4 × 6 inch Studio Print (Standard Postcard)',
      price: 15,
      metadata: JSON.stringify({ widthInches: 4, heightInches: 6 }),
    },
    {
      key: "5x7",
      name: '5 × 7 inch Studio Portrait Print',
      price: 30,
      metadata: JSON.stringify({ widthInches: 5, heightInches: 7 }),
    },
    {
      key: "a4_photo",
      name: 'A4 (8 × 12 inch) Studio Portrait Enlargement',
      price: 80,
      metadata: JSON.stringify({ widthInches: 8.27, heightInches: 11.69 }),
    },
  ];

  for (const p of photoSizes) {
    const optId = `opt_photo_${p.key}`;
    await db
      .insert(serviceOptions)
      .values({
        id: optId,
        serviceId: "srv_photo",
        optionGroup: "photo_size",
        optionKey: p.key,
        optionName: p.name,
        metadataJson: p.metadata,
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(servicePrices)
      .values({
        id: `prc_photo_${p.key}`,
        serviceId: "srv_photo",
        optionId: optId,
        price: p.price,
        unit: "per_print",
        minQuantity: 1,
        maxQuantity: 500,
      })
      .onConflictDoNothing();
  }

  console.log("Pricing matrix successfully seeded for all services.");
  console.log("Bishnu Studio database seeding complete!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
