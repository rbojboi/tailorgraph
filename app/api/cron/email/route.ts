import { deliverPendingEmails } from "@/lib/notifications";
import { authorizeEmailWorker } from "@/lib/email-worker-auth";
import { authorizeQStash, EMAIL_WORKER_URL } from "@/lib/qstash-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await authorizeEmailWorker(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return runWorker();
}

export async function POST(request: Request) {
  if (!(await authorizeQStash(request, EMAIL_WORKER_URL))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return runWorker();
}

async function runWorker() {
  const {processCommercePayments}=await import("@/lib/commerce-payments");
  const {processOfferAuthorizations}=await import("@/lib/offer-authorization");
  await processOfferAuthorizations();
  await processCommercePayments();
  const result = await deliverPendingEmails();
  return Response.json(result, { status: result.configured ? 200 : 503 });
}
