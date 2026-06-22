import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  findOrderByReturnProviderTransactionId,
  findOrderByShippingProviderTransactionId,
  updateOrderReturnTrackingFromProvider,
  updateOrderTrackingFromProvider
} from "@/lib/store";

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

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNestedString(record: Record<string, unknown>, key: string, nestedKey: string) {
  const value = record[key];
  if (!value || typeof value !== "object") {
    return null;
  }

  const nested = (value as Record<string, unknown>)[nestedKey];
  return typeof nested === "string" && nested.trim() ? nested : null;
}

function readTrackingStatus(record: Record<string, unknown>) {
  return readString(record, "tracking_status") || readNestedString(record, "tracking_status", "status");
}

function readProvider(record: Record<string, unknown>) {
  return readString(record, "provider") || readNestedString(record, "rate", "provider");
}

function readTransactionId(record: Record<string, unknown>) {
  return (
    readString(record, "object_id") ||
    readString(record, "transaction") ||
    readNestedString(record, "transaction", "object_id")
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;
  const transaction = readTransactionObject(body);

  if (!transaction) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const transactionId = readTransactionId(transaction);

  if (!transactionId) {
    return NextResponse.json({ received: true });
  }

  const outboundOrder = await findOrderByShippingProviderTransactionId(transactionId);
  if (outboundOrder) {
    await updateOrderTrackingFromProvider(outboundOrder.id, {
      carrier: readProvider(transaction) || outboundOrder.carrier,
      trackingNumber: readString(transaction, "tracking_number") || outboundOrder.trackingNumber,
      trackingUrl: readString(transaction, "tracking_url_provider") || outboundOrder.trackingUrl,
      trackingStatus: readTrackingStatus(transaction) || outboundOrder.trackingStatus,
      shippingEta: readString(transaction, "eta") || outboundOrder.shippingEta
    });

    revalidatePath("/seller");
    revalidatePath(`/seller/orders/${outboundOrder.id}`);
    revalidatePath("/buyer");
    revalidatePath("/buyer/orders");

    return NextResponse.json({ received: true, kind: "outbound" });
  }

  const returnOrder = await findOrderByReturnProviderTransactionId(transactionId);
  if (!returnOrder) {
    return NextResponse.json({ received: true });
  }

  await updateOrderReturnTrackingFromProvider(returnOrder.id, {
    carrier: readProvider(transaction) || returnOrder.returnCarrier,
    trackingNumber: readString(transaction, "tracking_number") || returnOrder.returnTrackingNumber,
    trackingUrl: readString(transaction, "tracking_url_provider") || returnOrder.returnTrackingUrl,
    trackingStatus: readTrackingStatus(transaction) || returnOrder.returnTrackingStatus,
    returnEta: readString(transaction, "eta") || returnOrder.returnEta
  });

  revalidatePath("/seller");
  revalidatePath(`/seller/orders/${returnOrder.id}`);
  revalidatePath("/buyer");
  revalidatePath("/buyer/orders");

  return NextResponse.json({ received: true, kind: "return" });
}
