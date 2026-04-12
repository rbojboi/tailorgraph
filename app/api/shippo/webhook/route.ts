import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { findOrderByShippingProviderTransactionId, updateOrderTrackingFromProvider } from "@/lib/store";

function readTransactionObject(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;

  if (data) {
    return data;
  }

  return record;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;
  const transaction = readTransactionObject(body);

  if (!transaction) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const transactionId =
    typeof transaction.object_id === "string"
      ? transaction.object_id
      : typeof transaction.transaction === "string"
        ? transaction.transaction
        : null;

  if (!transactionId) {
    return NextResponse.json({ received: true });
  }

  const order = await findOrderByShippingProviderTransactionId(transactionId);
  if (!order) {
    return NextResponse.json({ received: true });
  }

  await updateOrderTrackingFromProvider(order.id, {
    carrier: typeof transaction.provider === "string" ? transaction.provider : order.carrier,
    trackingNumber: typeof transaction.tracking_number === "string" ? transaction.tracking_number : order.trackingNumber,
    trackingUrl:
      typeof transaction.tracking_url_provider === "string" ? transaction.tracking_url_provider : order.trackingUrl,
    trackingStatus: typeof transaction.tracking_status === "string" ? transaction.tracking_status : order.trackingStatus,
    shippingEta: typeof transaction.eta === "string" ? transaction.eta : order.shippingEta
  });

  revalidatePath("/seller");
  revalidatePath("/buyer");
  revalidatePath("/buyer/orders");

  return NextResponse.json({ received: true });
}
