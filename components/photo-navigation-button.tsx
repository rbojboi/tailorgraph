export function PhotoNavigationButton({ direction, label, onClick, dark = false, className = "" }: {
  direction: "previous" | "next";
  label: string;
  onClick: () => void;
  dark?: boolean;
  className?: string;
}) {
  return <button type="button" aria-label={label} onClick={onClick}
    className={`group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? "text-white focus-visible:outline-white" : "text-stone-900 focus-visible:outline-stone-950"} ${className}`}>
    <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${dark ? "border-white/25 bg-stone-900 group-hover:bg-stone-700" : "border-stone-200 bg-white/95 shadow-sm group-hover:bg-white"}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d={direction === "previous" ? "m15.5 5-7 7 7 7" : "m8.5 5 7 7-7 7"} />
      </svg>
    </span>
  </button>;
}
