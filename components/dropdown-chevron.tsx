export function DropdownChevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center text-stone-500 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
