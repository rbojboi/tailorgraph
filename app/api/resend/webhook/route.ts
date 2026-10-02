import { Resend } from "resend";
import { applyEmailStatus } from "@/lib/email-monitor";

export async function POST(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return new Response("Webhook not configured",{status:503});
  const body=await request.text();
  if (body.length>65536) return new Response("Payload too large",{status:413});
  let event;
  try {
    event=new Resend(process.env.RESEND_API_KEY || "webhook-verification-only").webhooks.verify({payload:body,headers:{
      id:request.headers.get("svix-id") ?? "",timestamp:request.headers.get("svix-timestamp") ?? "",
      signature:request.headers.get("svix-signature") ?? ""
    },webhookSecret:process.env.RESEND_WEBHOOK_SECRET});
  } catch { return new Response("Invalid signature",{status:400}); }
  if ("email_id" in event.data && typeof event.data.email_id === "string") {
    await applyEmailStatus(event.data.email_id,event.type.replace("email.",""));
  }
  return Response.json({received:true});
}
