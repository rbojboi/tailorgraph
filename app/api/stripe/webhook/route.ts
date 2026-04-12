import Stripe from "stripe";
import { sendOrderPurchasedNotifications } from "@/lib/notifications";
import { getStripe } from "@/lib/stripe";
import {
  findListingById,
  findUserById,
  listOrdersByStripeCheckoutSessionId,
  markListingSold,
  markOrderFailedBySessionId,
  markOrderPaidBySessionId
} from "@/lib/store";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response("Webhook secret not configured", { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return new Response(message, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orders = await listOrdersByStripeCheckoutSessionId(session.id);

    if (orders.length > 0) {
      await markOrderPaidBySessionId(
        session.id,
        typeof session.payment_intent === "string" ? session.payment_intent : null
      );
      await Promise.all(
        orders.map(async (order) => {
          const listing = await findListingById(order.listingId);
          const [buyer, seller] = await Promise.all([findUserById(order.buyerId), findUserById(order.sellerId)]);
          if (listing?.status === "active") {
            await markListingSold(order.listingId);
          }
          if (buyer && seller) {
            await sendOrderPurchasedNotifications({
              order,
              listing,
              buyer,
              seller
            });
          }
        })
      );
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await markOrderFailedBySessionId(session.id);
  }

  return Response.json({ received: true });
}
