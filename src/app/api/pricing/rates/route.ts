import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { services, serviceOptions, servicePrices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const allServices = await db.select().from(services);
    const allOptions = await db.select().from(serviceOptions);
    const allPrices = await db.select().from(servicePrices);

    // Group options and prices by service
    const catalog = allServices.map((srv) => {
      const srvOptions = allOptions
        .filter((o) => o.serviceId === srv.id && o.isActive)
        .map((opt) => {
          const priceRec = allPrices.find((p) => p.optionId === opt.id);
          return {
            id: opt.id,
            group: opt.optionGroup,
            key: opt.optionKey,
            name: opt.optionName,
            metadata: opt.metadataJson ? JSON.parse(opt.metadataJson) : null,
            price: priceRec?.price || 0,
            unit: priceRec?.unit || "per_unit",
            priceId: priceRec?.id || null,
          };
        });

      return {
        ...srv,
        options: srvOptions,
      };
    });

    return NextResponse.json({ success: true, services: catalog });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch pricing rates." },
      { status: 500 }
    );
  }
}
