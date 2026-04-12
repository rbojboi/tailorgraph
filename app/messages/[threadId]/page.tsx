import { redirect } from "next/navigation";

export default async function MessageThreadRedirectPage({
  params,
  searchParams
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { threadId } = await params;
  const query = await searchParams;
  const view = Array.isArray(query.view) ? query.view[0] : query.view;
  redirect(`/messages?thread=${encodeURIComponent(threadId)}${view === "unread" ? "&view=unread" : ""}`);
}
