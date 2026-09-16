import { reconcileReturns } from "@/lib/returns";
import { deliverReturnNotifications } from "@/lib/return-notifications";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const result = await reconcileReturns();
  await deliverReturnNotifications();
  return Response.json(result, { status: result.errors.length ? 500 : 200 });
}
