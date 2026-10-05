import { authorizeQStash, EMAIL_HEALTH_URL } from "@/lib/qstash-auth";
import { checkEmailWorkerHealth } from "@/lib/email-worker-health";
import { requirePool } from "@/lib/store";
import { sendEmailWorkerHealthAlert } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await authorizeQStash(request, EMAIL_HEALTH_URL))) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await checkEmailWorkerHealth(async () => {
      const result = await requirePool().query("SELECT last_success_at FROM email_worker_health WHERE id=1");
      return result.rows[0]?.last_success_at ?? null;
    }, sendEmailWorkerHealthAlert);
    return Response.json(result);
  } catch {
    console.error("Email worker health alert could not be delivered");
    return Response.json({ error: "Health alert unavailable" }, { status: 503 });
  }
}

