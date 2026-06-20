import { formatDisplayValue } from "./display";

type OrderStatusDisplaySource = {
  status: string;
  issueReason?: string | null;
  trackingStatus: string | null;
  shippingLabelUrl?: string | null;
  shippingQrCodeUrl?: string | null;
};

function normalizeStatus(value: string | null | undefined) {
  return (value || "").trim().replace(/-/g, "_").toUpperCase();
}

function formatCarrierTrackingStatus(trackingStatus: string) {
  switch (normalizeStatus(trackingStatus)) {
    case "PRE_TRANSIT":
      return "Paid";
    case "TRANSIT":
      return "In Transit";
    case "DELIVERED":
      return "Delivered";
    case "RETURNED":
      return "Returned";
    case "FAILURE":
      return "Delivery Issue";
    case "UNKNOWN":
      return "Tracking Pending";
    default:
      return formatDisplayValue(trackingStatus.toLowerCase());
  }
}

export function getSellerOrderStatusLabel(order: OrderStatusDisplaySource) {
  if (order.status === "canceled") {
    return "Canceled";
  }

  if (order.status === "refunded") {
    return "Refunded";
  }

  if (order.status === "failed") {
    return "Failed";
  }

  if (order.trackingStatus) {
    return formatCarrierTrackingStatus(order.trackingStatus);
  }

  if (order.status === "shipped" && (order.shippingLabelUrl || order.shippingQrCodeUrl)) {
    return "Paid";
  }

  if (order.status === "issue_open") {
    if (order.issueReason?.toLowerCase().includes("return")) {
      return "Return Requested";
    }

    return "Issue Open";
  }

  return formatDisplayValue(order.status);
}
