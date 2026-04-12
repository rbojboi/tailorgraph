import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteMessageThreadAction,
  restoreMessageThreadAction,
  sendMessageReplyAction,
  startDirectMessageThreadAction,
  startListingMessageThreadAction
} from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureSeedData,
  findListingById,
  findMessageThreadByIdForUser,
  listMessageThreadsForUser,
  listMessagesForThread,
  markMessageThreadReadForUser
} from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderLinkedMessageBody(body: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const fullUrlPattern = /^https?:\/\/[^\s]+$/;
  const parts = body.split(urlPattern);

  return parts.map((part, index) => {
    if (fullUrlPattern.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 transition hover:opacity-80"
        >
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function TrashCanIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="none">
      <path d="M7.5 5V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 4v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M6.25 7.25 6.8 16a1.5 1.5 0 0 0 1.5 1.4h3.4a1.5 1.5 0 0 0 1.5-1.4l.55-8.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.75 9.25v5.5M11.25 9.25v5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default async function MessagesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+to+view+messages");
  }

  const params = await searchParams;
  const authError = firstValue(params.authError);
  const deletedThreadId = firstValue(params.conversationDeleted);
  const compose = firstValue(params.compose) === "1";
  const composeRecipient = firstValue(params.to) ?? "";
  const view = firstValue(params.view) === "unread" ? "unread" : "all";
  const selectedThreadId = firstValue(params.thread);
  const opened = firstValue(params.opened) === "1";
  const listingId = firstValue(params.listingId);
  const listing = listingId ? await findListingById(listingId) : null;
  const selectedThread = selectedThreadId ? await findMessageThreadByIdForUser(user.id, selectedThreadId) : null;

  if (selectedThreadId && !selectedThread) {
    redirect("/messages?authError=Conversation+not+found");
  }

  if (selectedThread && selectedThread.unread && !opened) {
    await markMessageThreadReadForUser(user.id, selectedThread.id);
    redirect(`/messages?thread=${selectedThread.id}${view === "unread" ? "&view=unread" : ""}&opened=1`);
  }

  const allThreads = await listMessageThreadsForUser(user.id);
  const threads = view === "unread" ? await listMessageThreadsForUser(user.id, { unreadOnly: true }) : allThreads;
  const unreadThreadCount = allThreads.filter((thread) => thread.unread).length;
  const messages = selectedThread ? await listMessagesForThread(selectedThread.id) : [];

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-6xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Messages"
            title="Buyer and Seller Messaging"
            description="Ask questions about listings, follow up on purchases, and keep conversations in one place."
          />
          {authError ? <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
          {deletedThreadId ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800">
              <span>Conversation deleted from your inbox.</span>
              <form action={restoreMessageThreadAction}>
                <input type="hidden" name="threadId" value={deletedThreadId} />
                <button className="rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800">
                  Undo
                </button>
              </form>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
            <aside className="rounded-[1.5rem] border border-stone-300 bg-white p-4 lg:h-[44rem]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-stone-950">Inbox</h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {threads.length}
                  </span>
                  <Link
                    href="/messages?compose=1"
                    className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  >
                    New Message
                  </Link>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href="/messages"
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    view === "all" ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  All Messages
                </Link>
                <Link
                  href="/messages?view=unread"
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    view === "unread" ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  Unread{unreadThreadCount ? ` (${unreadThreadCount})` : ""}
                </Link>
              </div>
              <div className="mt-4 grid max-h-[36rem] gap-3 overflow-y-auto pr-1">
                {threads.length ? (
                  threads.map((thread) => {
                    const counterpart =
                      thread.buyerId === user.id ? thread.sellerUsername || "seller" : thread.buyerUsername || "buyer";

                    return (
                      <div
                        key={thread.id}
                        className={`rounded-[1.25rem] border px-4 py-3 transition hover:border-stone-950 hover:bg-white ${
                          selectedThread?.id === thread.id
                            ? "border-stone-950 bg-stone-950 text-white"
                            : 
                          thread.unread ? "border-[var(--accent)] bg-amber-50/40" : "border-stone-200 bg-stone-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/messages?thread=${thread.id}${view === "unread" ? "&view=unread" : ""}`}
                            className="min-w-0 flex-1"
                          >
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-semibold ${selectedThread?.id === thread.id ? "text-white" : "text-stone-950"}`}>
                                {thread.listingTitle || thread.subject}
                              </p>
                              {thread.unread && selectedThread?.id !== thread.id ? <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> : null}
                            </div>
                            <p className={`mt-1 text-xs uppercase tracking-[0.16em] ${selectedThread?.id === thread.id ? "text-stone-300" : "text-stone-500"}`}>
                              {counterpart}
                            </p>
                            <p className={`mt-2 truncate text-sm ${selectedThread?.id === thread.id ? "text-stone-200" : "text-stone-700"}`}>
                              {thread.lastMessagePreview || "Open conversation"}
                            </p>
                          </Link>
                          <div className="grid shrink-0 justify-items-end gap-2">
                            <span className={`text-[11px] ${selectedThread?.id === thread.id ? "text-stone-300" : "text-stone-500"}`}>
                              {formatMessageTime(thread.lastMessageAt)}
                            </span>
                            <form action={deleteMessageThreadAction}>
                              <input type="hidden" name="threadId" value={thread.id} />
                              <ConfirmDeleteButton
                                message="Delete this conversation from your inbox?"
                                className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                                  selectedThread?.id === thread.id
                                    ? "border-stone-500 text-stone-300 hover:border-white hover:text-white"
                                    : "border-stone-300 bg-white text-stone-500 hover:border-stone-400 hover:text-stone-700"
                                }`}
                              >
                                <TrashCanIcon />
                                <span className="sr-only">Delete conversation</span>
                              </ConfirmDeleteButton>
                            </form>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-stone-600">
                    No conversations yet.
                  </div>
                )}
              </div>
            </aside>

            <section className="rounded-[1.5rem] border border-stone-300 bg-white p-5 sm:p-6 lg:h-[44rem]">
              {selectedThread ? (
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-stone-50 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Conversation</p>
                  <Link
                    href={`/users/${selectedThread.buyerId === user.id ? selectedThread.sellerUsername || "seller" : selectedThread.buyerUsername || "buyer"}?from=messages&thread=${selectedThread.id}`}
                    className="mt-1 inline-block text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]"
                  >
                    {selectedThread.buyerId === user.id ? selectedThread.sellerUsername || "seller" : selectedThread.buyerUsername || "buyer"}
                  </Link>
                </div>
                <div className="flex flex-wrap items-start justify-end gap-3 text-right">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Subject</p>
                    {selectedThread.listingId ? (
                      <Link
                        href={`/listings/${selectedThread.listingId}`}
                        className="mt-1 inline-block text-sm font-semibold text-[var(--accent)] transition hover:text-stone-950"
                      >
                        {selectedThread.listingTitle || selectedThread.subject}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-stone-950">{selectedThread.subject}</p>
                    )}
                  </div>
                  <form action={deleteMessageThreadAction}>
                    <input type="hidden" name="threadId" value={selectedThread.id} />
                    <ConfirmDeleteButton
                      message="Delete this conversation from your inbox?"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
                    >
                      <TrashCanIcon />
                      <span className="sr-only">Delete conversation</span>
                    </ConfirmDeleteButton>
                  </form>
                </div>
              </div>

                  <div className="mt-4 grid flex-1 gap-3 overflow-y-auto pr-1">
                    {messages.length ? (
                      messages.map((message) => {
                        const isCurrentUser = message.senderId === user.id;
                        return (
                          <div
                            key={message.id}
                            className={`max-w-[42rem] rounded-[1.5rem] px-4 py-3 ${
                              isCurrentUser ? "ml-auto bg-stone-950 text-white" : "bg-stone-100 text-stone-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className={`text-xs uppercase tracking-[0.16em] ${isCurrentUser ? "text-stone-300" : "text-stone-500"}`}>
                                {message.senderUsername}
                              </p>
                              <p className={`text-[11px] ${isCurrentUser ? "text-stone-300" : "text-stone-500"}`}>
                                {formatMessageTime(message.createdAt)}
                              </p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{renderLinkedMessageBody(message.body)}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-stone-600">
                        No messages yet.
                      </div>
                    )}
                  </div>

                  <form action={sendMessageReplyAction} className="mt-5 grid gap-4 border-t border-stone-200 pt-5">
                    <input type="hidden" name="threadId" value={selectedThread.id} />
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-stone-700">Reply</span>
                      <textarea
                        name="messageBody"
                        rows={5}
                        placeholder="Write your message here."
                        maxLength={1000}
                        className="rounded-[1.5rem] border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
                        Send Reply
                      </button>
                    </div>
                  </form>
                </div>
              ) : listing ? (
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">{listing.location}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-stone-950">Message the seller about {listing.title}</h2>
                  <form action={startListingMessageThreadAction} className="mt-5 grid gap-4">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-stone-700">Message</span>
                      <textarea
                        name="messageBody"
                        rows={7}
                        placeholder={`Hi, I'm interested in ${listing.title}.`}
                        maxLength={1000}
                        className="rounded-[1.5rem] border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
                        Send Message
                      </button>
                      <Link
                        href={`/listings/${listing.id}`}
                        className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900"
                      >
                        Back to Item
                      </Link>
                    </div>
                  </form>
                </div>
              ) : compose ? (
                <div className="flex h-full flex-col">
                  <h2 className="mt-4 text-2xl font-semibold text-stone-950">Start a new conversation</h2>
                  <form action={startDirectMessageThreadAction} className="mt-5 grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">Recipient Username</span>
                        <input
                          name="recipientUsername"
                          type="text"
                          placeholder="username"
                          defaultValue={composeRecipient}
                          className="rounded-[1.5rem] border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">Subject (max. 60 characters)</span>
                        <input
                          name="subject"
                          type="text"
                          placeholder="Subject"
                          maxLength={60}
                          className="rounded-[1.5rem] border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-stone-700">Message (max. 1000 characters)</span>
                      <textarea
                        name="messageBody"
                        rows={7}
                        placeholder="Write your message here."
                        maxLength={1000}
                        className="rounded-[1.5rem] border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
                        Send Message
                      </button>
                      <Link
                        href="/messages"
                        className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900"
                      >
                        Cancel
                      </Link>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex h-full min-h-[24rem] flex-col justify-center rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
                  <h2 className="text-2xl font-semibold text-stone-950">Select a conversation or start a new one</h2>
                  <p className="mt-3 text-sm leading-7 text-stone-700">
                    Open any thread from the inbox, use New Message to message another user directly, or use the Message Seller button on a listing.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
