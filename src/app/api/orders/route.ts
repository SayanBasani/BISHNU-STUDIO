import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderFiles,
  products,
  users,
} from "@/db/schema";
import {
  calculatePvcPrice,
  calculateDocumentPrintPrice,
  calculateLaminationPrice,
  calculatePhotoPrintPrice,
  calculateProductItemPrice,
} from "@/lib/pricing";
import { generateOrderReference } from "@/lib/utils";
import { logAuditEvent } from "@/lib/audit";
import { recordOrderEvent } from "@/lib/order-timeline";
import { getShopSettings } from "@/lib/settings";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const orderItemSchema = z.object({
  itemType: z.enum([
    "product",
    "pvc_card",
    "document_print",
    "lamination",
    "photo_print",
  ]),
  productId: z.string().optional(),
  serviceId: z.string().optional(),
  quantity: z.number().int().min(1),
  configuration: z.record(z.any()),
  specialInstructions: z.string().optional(),
  fileIds: z.array(z.string()).optional(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Order must contain at least one item"),
  deliveryType: z.enum(["store_pickup", "home_delivery"]),
  paymentMethod: z.enum(["cash_on_collection", "upi_mock", "online"]),
  orderNotes: z.string().optional(),
  shippingAddress: z
    .object({
      recipientName: z.string().optional(),
      recipientPhone: z.string().optional(),
      addressType: z.string().optional(),
      houseBuilding: z.string().optional(),
      streetLocality: z.string().optional(),
      landmark: z.string().optional().nullable(),
      cityTown: z.string().optional(),
      state: z.string().optional(),
      pinCode: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json(
        { error: "Please log in to place an order." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { items, deliveryType, paymentMethod, orderNotes, shippingAddress } =
      validation.data;

    // Server-side enforcement: Check business open/closed availability (Phase 3.3)
    const settings = await getShopSettings();
    if (settings.isOpen === false) {
      return NextResponse.json(
        {
          error:
            settings.closedMessage ||
            "The store is currently closed for new orders. Browsing and existing order tracking remain active.",
          code: "STORE_CLOSED",
        },
        { status: 403 }
      );
    }

    // Server-side address validation: Home delivery strictly requires full address details
    if (deliveryType === "home_delivery") {
      if (
        !shippingAddress ||
        !shippingAddress.houseBuilding?.trim() ||
        !shippingAddress.streetLocality?.trim() ||
        !shippingAddress.cityTown?.trim() ||
        !shippingAddress.state?.trim() ||
        !shippingAddress.pinCode?.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Complete shipping address (house/building, street/locality, city, state, and PIN code) is required for home delivery.",
          },
          { status: 400 }
        );
      }
    }

    const orderId = `ord_${crypto.randomUUID()}`;
    const orderReference = generateOrderReference();

    let calculatedSubtotal = 0;
    const verifiedItems: Array<{
      id: string;
      itemType: string;
      productId?: string;
      serviceId?: string;
      configurationJson: string;
      quantity: number;
      pageCount: number;
      unitPriceSnapshot: number;
      totalPriceSnapshot: number;
      specialInstructions?: string;
      fileIds?: string[];
    }> = [];

    // Server-side cart deduplication guard:
    // Merge any duplicate product lines with identical productId and configuration
    const mergedInputItems: typeof items = [];
    const itemMap = new Map<string, (typeof items)[0]>();

    for (const rawItem of items) {
      if (rawItem.itemType === "product" && rawItem.productId) {
        const configStr = rawItem.configuration
          ? JSON.stringify(rawItem.configuration, Object.keys(rawItem.configuration).sort())
          : "";
        const key = `prod_${rawItem.productId}_${configStr}`;
        const existing = itemMap.get(key);
        if (existing) {
          existing.quantity += rawItem.quantity;
        } else {
          const cloned = { ...rawItem };
          itemMap.set(key, cloned);
          mergedInputItems.push(cloned);
        }
      } else {
        mergedInputItems.push(rawItem);
      }
    }

    // Recalculate every single item on the server
    for (const item of mergedInputItems) {
      const itemId = `itm_${crypto.randomUUID()}`;
      let unitPrice = 0;
      let totalPrice = 0;
      let pageCount = 1;
      let resolvedServiceId = item.serviceId;

      if (item.itemType === "product") {
        if (!item.productId) {
          return NextResponse.json(
            { error: "Product identifier is required for shop items." },
            { status: 400 }
          );
        }
        const calc = await calculateProductItemPrice(
          item.productId,
          item.quantity
        );
        unitPrice = calc.unitPrice;
        totalPrice = calc.totalPrice;

        // Decrement product inventory
        await db
          .update(products)
          .set({
            stockQuantity: calc.product.stockQuantity - item.quantity,
            updatedAt: Date.now(),
          })
          .where(eq(products.id, item.productId));
      } else if (item.itemType === "pvc_card") {
        resolvedServiceId = "srv_pvc";
        const calc = await calculatePvcPrice({
          documentType: item.configuration.documentType || "aadhaar",
          copies: item.quantity,
        });
        unitPrice = calc.unitPrice;
        totalPrice = calc.totalPrice;
      } else if (item.itemType === "document_print") {
        resolvedServiceId = "srv_doc";
        pageCount = Math.max(1, Number(item.configuration.pageCount) || 1);
        const calc = await calculateDocumentPrintPrice({
          paperSize: item.configuration.paperSize || "A4",
          printMode: item.configuration.printMode || "bw",
          sides: item.configuration.sides || "single",
          pageCount,
          copies: item.quantity,
          includeLamination: Boolean(item.configuration.includeLamination),
        });
        unitPrice = calc.unitPrice;
        totalPrice = calc.totalPrice;
      } else if (item.itemType === "lamination") {
        resolvedServiceId = "srv_lam";
        const sheets = Math.max(1, Number(item.configuration.sheets) || 1);
        const calc = await calculateLaminationPrice({
          laminationSize: item.configuration.laminationSize || "a4_glossy",
          sheets,
          copies: item.quantity,
        });
        unitPrice = calc.unitPrice;
        totalPrice = calc.totalPrice;
      } else if (item.itemType === "photo_print") {
        resolvedServiceId = "srv_photo";
        const imageCount = Math.max(
          1,
          Number(item.configuration.imageCount) ||
            item.configuration.uploadedFiles?.length ||
            1
        );
        const calc = await calculatePhotoPrintPrice({
          photoSize: item.configuration.photoSize || "4x6",
          photoFinish: item.configuration.photoFinish || "glossy",
          imageCount,
          copiesPerImage: item.quantity,
        });
        unitPrice = calc.unitPrice;
        totalPrice = calc.totalPrice;
      }

      calculatedSubtotal += totalPrice;

      verifiedItems.push({
        id: itemId,
        itemType: item.itemType,
        productId: item.productId,
        serviceId: resolvedServiceId,
        configurationJson: JSON.stringify(item.configuration),
        quantity: item.quantity,
        pageCount,
        unitPriceSnapshot: unitPrice,
        totalPriceSnapshot: totalPrice,
        specialInstructions: item.specialInstructions,
        fileIds: item.fileIds || [],
      });
    }

    // Determine delivery charges
    const deliveryCharge =
      deliveryType === "home_delivery" && calculatedSubtotal < 500 ? 40 : 0;
    const finalTotal = calculatedSubtotal + deliveryCharge;

    const initialPaymentStatus = "unpaid";

    // Determine order type: 'shopping', 'print_service', or 'hybrid'
    const hasProduct = verifiedItems.some((i) => i.itemType === "product");
    const hasService = verifiedItems.some((i) => i.itemType !== "product");
    const orderType =
      hasProduct && hasService
        ? "hybrid"
        : hasProduct
        ? "shopping"
        : "print_service";

    // Insert Order record
    await db.insert(orders).values({
      id: orderId,
      orderReference,
      customerId: auth.user.id,
      orderType,
      subtotal: calculatedSubtotal,
      discount: 0,
      additionalCharges: deliveryCharge,
      totalAmount: finalTotal,
      paymentStatus: initialPaymentStatus,
      paymentMethod,
      orderStatus: "pending",
      deliveryType,
      orderNotes: orderNotes || null,
      shippingAddressJson: shippingAddress
        ? JSON.stringify(shippingAddress)
        : null,
    });

    // Insert Order Items and Link Uploaded Files
    for (const item of verifiedItems) {
      await db.insert(orderItems).values({
        id: item.id,
        orderId,
        itemType: item.itemType as any,
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        configurationJson: item.configurationJson,
        quantity: item.quantity,
        pageCount: item.pageCount,
        unitPriceSnapshot: item.unitPriceSnapshot,
        totalPriceSnapshot: item.totalPriceSnapshot,
        specialInstructions: item.specialInstructions || null,
      });

      // Link any files associated with this item
      if (item.fileIds && item.fileIds.length > 0) {
        for (const fId of item.fileIds) {
          await db
            .update(orderFiles)
            .set({
              orderId,
              orderItemId: item.id,
            })
            .where(eq(orderFiles.id, fId));
        }
      }
    }

    // Record initial order timeline event
    await recordOrderEvent({
      orderId,
      previousStatus: null,
      newStatus: "pending",
      previousPaymentStatus: null,
      newPaymentStatus: initialPaymentStatus,
      changedByUserId: auth.user.id,
      actorRole: "customer",
      customerMessage:
        paymentMethod === "upi_mock"
          ? "Order created. Please complete UPI payment and submit transaction reference."
          : "Order created with Cash on Collection.",
      internalNote: `Order ${orderReference} created via ${paymentMethod}. Total: ₹${finalTotal}. Payment status: unpaid.`,
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "order_created",
      entityType: "order",
      entityId: orderId,
      details: {
        orderReference,
        totalAmount: finalTotal,
        itemCount: verifiedItems.length,
      },
    });

    // Dispatch persistent notifications
    try {
      const { createNotification } = await import("@/lib/notifications");
      // Customer notification
      await createNotification({
        recipientType: "customer",
        recipientId: auth.user.id,
        category: "order",
        eventType: "order_created",
        title: `Order Placed (${orderReference})`,
        message: `Your order #${orderReference} for ₹${finalTotal.toLocaleString("en-IN")} has been placed successfully.`,
        entityType: "order",
        entityId: orderId,
        linkUrl: `/account/orders/${orderId}`,
        deduplicationKey: `notif_order_created_${orderId}`,
      });

      // Admin notification
      await createNotification({
        recipientType: "admin",
        category: "order",
        eventType: "new_order_received",
        title: `New Order Received (${orderReference})`,
        message: `New order #${orderReference} placed by ${auth.user.fullName || "Customer"} for ₹${finalTotal.toLocaleString("en-IN")}.`,
        entityType: "order",
        entityId: orderId,
        linkUrl: `/admin/orders/${orderId}`,
        priority: "high",
        deduplicationKey: `notif_admin_order_created_${orderId}`,
      });
    } catch (notifErr) {
      console.error("Failed to dispatch order creation notifications:", notifErr);
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderReference,
      totalAmount: finalTotal,
      orderStatus: "pending",
      paymentStatus: initialPaymentStatus,
    });
  } catch (error: any) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to place order." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    if (!isAdmin) {
      // Customers can ONLY see their own orders
      const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, auth.user.id))
        .orderBy(desc(orders.createdAt));

      const userOrderIds = userOrders.map((o) => o.id);
      const itemCountMap = new Map<string, number>();

      if (userOrderIds.length > 0) {
        const allItems = await db
          .select({ orderId: orderItems.orderId, quantity: orderItems.quantity })
          .from(orderItems)
          .where(inArray(orderItems.orderId, userOrderIds));

        for (const item of allItems) {
          itemCountMap.set(
            item.orderId,
            (itemCountMap.get(item.orderId) || 0) + (item.quantity || 1)
          );
        }
      }

      const formatted = userOrders.map((ord) => {
        let addr = null;
        try {
          if (ord.shippingAddressJson) addr = JSON.parse(ord.shippingAddressJson);
        } catch (e) {}

        return {
          ...ord,
          itemCount: itemCountMap.get(ord.id) || 0,
          shippingAddress: addr,
        };
      });

      return NextResponse.json({ success: true, orders: formatted });
    } else {
      // Admins see all orders with pagination, search, filters, customer contact, and delivery summary
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
      const search = searchParams.get("search")?.trim().toLowerCase();
      const orderStatus = searchParams.get("orderStatus") || searchParams.get("status");
      const paymentStatus = searchParams.get("paymentStatus");
      const deliveryType = searchParams.get("deliveryType");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const all = searchParams.get("all") === "true";

      const orderRows = await db
        .select({
          order: orders,
          customer: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          },
        })
        .from(orders)
        .leftJoin(users, eq(orders.customerId, users.id))
        .orderBy(desc(orders.createdAt));

      const filtered = orderRows.filter(({ order, customer }) => {
        if (orderStatus && orderStatus !== "all" && order.orderStatus !== orderStatus) {
          return false;
        }
        if (paymentStatus && paymentStatus !== "all" && order.paymentStatus !== paymentStatus) {
          return false;
        }
        if (deliveryType && deliveryType !== "all" && order.deliveryType !== deliveryType) {
          return false;
        }
        if (startDate) {
          const startTs = new Date(startDate).getTime();
          if (!isNaN(startTs) && order.createdAt < startTs) return false;
        }
        if (endDate) {
          const endTs = new Date(endDate).getTime();
          if (!isNaN(endTs) && order.createdAt > endTs) return false;
        }
        if (search) {
          const refMatch = order.orderReference.toLowerCase().includes(search);
          const nameMatch = customer?.fullName?.toLowerCase().includes(search);
          const phoneMatch = customer?.phone?.toLowerCase().includes(search);
          const emailMatch = customer?.email?.toLowerCase().includes(search);
          if (!refMatch && !nameMatch && !phoneMatch && !emailMatch) return false;
        }
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const paginated = all ? filtered : filtered.slice((page - 1) * limit, page * limit);

      const targetOrderIds = paginated.map((r) => r.order.id);
      const itemCountMap = new Map<string, number>();

      if (targetOrderIds.length > 0) {
        const items = await db
          .select({ orderId: orderItems.orderId, quantity: orderItems.quantity })
          .from(orderItems)
          .where(inArray(orderItems.orderId, targetOrderIds));

        for (const item of items) {
          itemCountMap.set(
            item.orderId,
            (itemCountMap.get(item.orderId) || 0) + (item.quantity || 1)
          );
        }
      }

      const formattedOrders = paginated.map(({ order, customer }) => {
        let addr: any = null;
        try {
          if (order.shippingAddressJson) addr = JSON.parse(order.shippingAddressJson);
        } catch (e) {}

        const isHomeDelivery = order.deliveryType === "home_delivery";
        const isAddressMissing =
          isHomeDelivery &&
          (!addr ||
            !addr.houseBuilding?.trim() ||
            !addr.cityTown?.trim() ||
            !addr.pinCode?.trim());

        return {
          ...order,
          customer: customer || null,
          itemCount: itemCountMap.get(order.id) || 0,
          shippingAddress: addr,
          isAddressMissing,
          deliverySummary: {
            cityTown: addr?.cityTown || null,
            pinCode: addr?.pinCode || null,
            recipientName: addr?.recipientName || customer?.fullName || null,
            recipientPhone: addr?.recipientPhone || customer?.phone || null,
            isAddressMissing,
          },
        };
      });

      return NextResponse.json({
        success: true,
        orders: formattedOrders,
        pagination: {
          total,
          page: all ? 1 : page,
          limit: all ? total : limit,
          totalPages: all ? 1 : totalPages,
        },
      });
    }
  } catch (error: any) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
