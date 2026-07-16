import { openIssueAction } from "@/app/actions";

type DisputeOption = {
  value: string;
  label: string;
};

const buyerProblemOptions: DisputeOption[] = [
  { value: "item_not_as_described", label: "Item was not as described" },
  { value: "damaged_or_missing", label: "Item arrived damaged or missing pieces" },
  { value: "shipping_problem", label: "Shipping or tracking problem" },
  { value: "return_refund_problem", label: "Return or refund problem" },
  { value: "seller_communication", label: "Seller communication issue" },
  { value: "trust_safety", label: "Trust and safety concern" }
];

const sellerProblemOptions: DisputeOption[] = [
  { value: "returned_damaged", label: "Returned item came back damaged" },
  { value: "returned_missing_pieces", label: "Returned item is missing pieces" },
  { value: "wrong_item_returned", label: "Wrong item was returned" },
  { value: "buyer_communication", label: "Buyer communication issue" },
  { value: "shipping_problem", label: "Shipping or carrier problem" },
  { value: "trust_safety", label: "Trust and safety concern" }
];

export function OrderDisputeForm({
  orderId,
  returnTo,
  role,
  compact = false
}: {
  orderId: string;
  returnTo: string;
  role: "buyer" | "seller";
  compact?: boolean;
}) {
  const options = role === "buyer" ? buyerProblemOptions : sellerProblemOptions;
  const title = role === "buyer" ? "Open a dispute for this order" : "Report a dispute for this order";
  const description =
    role === "buyer"
      ? "Use this when something needs TailorGraph review beyond a normal return."
      : "Use this when fulfillment, a return, or buyer conduct needs TailorGraph review.";

  return (
    <details className="rounded-[1.25rem] border border-stone-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-stone-950">{title}</summary>
      <form action={openIssueAction} className="mt-4 grid gap-4">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="issueReason" value={role === "buyer" ? "Dispute reported by buyer" : "Dispute reported by seller"} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <p className="text-sm leading-6 text-stone-700">{description}</p>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-stone-950">What went wrong?</legend>
          <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
            {options.map((option) => (
              <label key={option.value} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-800">
                <input name="issueCategory" value={option.value} type="checkbox" className="mt-1" />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-stone-950">Details</span>
          <textarea
            name="issueDetails"
            rows={compact ? 3 : 4}
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
            placeholder="Add what happened, dates, condition details, tracking notes, or what you already tried."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-stone-950">Preferred outcome</span>
          <select name="desiredOutcome" defaultValue="" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none">
            <option value="">Select an outcome</option>
            <option value="refund_review">Refund review</option>
            <option value="return_review">Return review</option>
            <option value="shipping_review">Shipping review</option>
            <option value="account_review">Account or safety review</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button className="w-fit rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95">
          Submit Dispute
        </button>
      </form>
    </details>
  );
}
