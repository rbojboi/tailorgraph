import { deliverPendingEmails } from "@/lib/notifications";
import { authorizeEmailWorker } from "@/lib/email-worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await authorizeEmailWorker(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await deliverPendingEmails();
  return Response.json(result, { status: result.configured ? 200 : 503 });
}
