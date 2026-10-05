import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  findOrderByReturnProviderTransactionId,
  findOrderByShippingProviderTransactionId,
  findOrderById,
  updateOrderReturnTrackingFromProvider,
  updateOrderTrackingFromProvider
} from "@/lib/store";
import { verifyShippoWebhookRequest } from "@/lib/shippo-webhook-auth";
import { requirePool } from "@/lib/store";
import { processReturn } from "@/lib/returns";
import { deliverReturnNotifications } from "@/lib/return-notifications";

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
    readString(record, "transaction") ||
    readNestedString(record, "transaction", "object_id") ||
    readString(record, "object_id")
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verification = verifyShippoWebhookRequest({
    body: rawBody,
    headers: request.headers,
    url: request.url
  });

  if (!verification.ok) {
    return NextResponse.json({ received: false, error: verification.message }, { status: verification.status });
  }

  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
  const transaction = readTransactionObject(body);

  if (!transaction) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const transactionId = readTransactionId(transaction);

  // track_updated carries a tracking object, whose object_id is not a label transaction ID.
  const trackingNumber = readString(transaction, "tracking_number");
  let outboundOrder = transactionId ? await findOrderByShippingProviderTransactionId(transactionId) : null;
  let returnOrder = transactionId ? await findOrderByReturnProviderTransactionId(transactionId) : null;
  if (outboundOrder && returnOrder) return NextResponse.json({ received: false }, { status: 400 });
  const carrier = readString(transaction, "carrier") || readProvider(transaction);
  if (!outboundOrder && !returnOrder && trackingNumber && carrier) {
    const matches = await requirePool().query(`SELECT id,'outbound' AS direction FROM orders WHERE tracking_number=$1
      AND LOWER(REPLACE(carrier,' ','_'))=LOWER(REPLACE($2,' ','_'))
      UNION ALL SELECT id,'return' AS direction FROM orders WHERE return_tracking_number=$1
      AND LOWER(REPLACE(return_carrier,' ','_'))=LOWER(REPLACE($2,' ','_'))`, [trackingNumber,carrier]);
    if (matches.rows.length === 1) {
      const match=matches.rows[0],order=await findOrderById(match.id);
      if(match.direction==='outbound') outboundOrder=order; else returnOrder=order;
    }
  }
  if (outboundOrder) {
    if (trackingNumber && outboundOrder.trackingNumber !== trackingNumber) return NextResponse.json({ received: false }, { status: 400 });
    await updateOrderTrackingFromProvider(outboundOrder.id, {
      carrier: readProvider(transaction) || outboundOrder.carrier,
      trackingNumber: readString(transaction, "tracking_number") || outboundOrder.trackingNumber,
      trackingUrl: readString(transaction, "tracking_url_provider") || outboundOrder.trackingUrl,
      trackingStatus: readTrackingStatus(transaction) || outboundOrder.trackingStatus,
      shippingEta: readString(transaction, "eta") || outboundOrder.shippingEta,
      deliveredAt: readNestedString(transaction, "tracking_status", "status_date")
    });

    revalidatePath("/seller");
    revalidatePath(`/seller/orders/${outboundOrder.id}`);
    revalidatePath("/buyer");
    revalidatePath("/buyer/orders");

    return NextResponse.json({ received: true, kind: "outbound" });
  }

  if (!returnOrder) {
    return NextResponse.json({ received: true });
  }
  if (trackingNumber && returnOrder.returnTrackingNumber !== trackingNumber) return NextResponse.json({ received: false }, { status: 400 });

  await updateOrderReturnTrackingFromProvider(returnOrder.id, {
    carrier: readProvider(transaction) || returnOrder.returnCarrier,
    trackingNumber: readString(transaction, "tracking_number") || returnOrder.returnTrackingNumber,
    trackingUrl: readString(transaction, "tracking_url_provider") || returnOrder.returnTrackingUrl,
    trackingStatus: readTrackingStatus(transaction) || returnOrder.returnTrackingStatus,
    returnEta: readString(transaction, "eta") || returnOrder.returnEta
  });
  await processReturn(returnOrder.id);
  await deliverReturnNotifications();

  revalidatePath("/seller");
  revalidatePath(`/seller/orders/${returnOrder.id}`);
  revalidatePath("/buyer");
  revalidatePath("/buyer/orders");

  return NextResponse.json({ received: true, kind: "return" });
}
