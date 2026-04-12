import type { ReactNode } from "react";
import Link from "next/link";

export function BuyerSubpageHeader({
  eyebrow,
  title,
  description,
  content,
  actionHref = "/buyer",
  actionLabel = "Back to Buyer Dashboard"
}: {
  eyebrow: string;
  title: string;
  description?: string;
  content?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="eyebrow text-xs text-stone-500">{eyebrow}</p>
          <h1 className="editorial mt-3 text-4xl font-semibold text-stone-950">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm text-stone-700">{description}</p> : null}
          {content ? <div className="mt-5">{content}</div> : null}
        </div>
        <Link
          href={actionHref}
          className="justify-self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 sm:justify-self-end"
        >
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
