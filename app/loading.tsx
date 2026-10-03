export default function Loading() {
  return (
    <main className="grain px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="h-3 w-36 animate-pulse rounded-full bg-stone-200" />
        <div className="rounded-[1.75rem] border border-stone-200 bg-white/75 p-6 shadow-[0_18px_50px_rgba(58,43,28,0.05)]">
          <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-full bg-stone-200" />
          <div className="mt-5 grid gap-3">
            <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-stone-100" />
            <div className="h-4 w-3/5 animate-pulse rounded-full bg-stone-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
