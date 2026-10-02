import { readUnsubscribeToken } from "@/lib/email-unsubscribe";
import { ensureSchema, requirePool } from "@/lib/store";

export async function POST(request: Request) {
  const token=new URL(request.url).searchParams.get("token") ?? "";
  const data=readUnsubscribeToken(token);
  if (!data) return new Response("Invalid unsubscribe link",{status:400});
  await ensureSchema();
  // JSON merge changes only this category. An old address cannot alter a changed account.
  await requirePool().query(`UPDATE users SET notification_preferences=jsonb_set(
    notification_preferences || jsonb_build_object($2::text,false),'{emailFrequency}',
    COALESCE(notification_preferences->'emailFrequency','{}'::jsonb) || jsonb_build_object($2::text,'off'))
    WHERE id=$1 AND lower(email)=$3`,[data.userId,data.key,data.email]);
  return new Response("Unsubscribed from this category. Essential order and security emails remain enabled.",{
    headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
  });
}
