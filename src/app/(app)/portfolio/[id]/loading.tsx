export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 animate-pulse space-y-8">
      <div className="h-3 w-32 bg-secondary rounded" />

      <header className="space-y-2">
        <div className="h-3 w-20 bg-secondary rounded" />
        <div className="h-9 w-64 bg-secondary rounded" />
        <div className="h-4 w-72 bg-secondary rounded" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-2">
            <div className="h-3 w-20 bg-secondary rounded" />
            <div className="h-7 w-32 bg-secondary rounded" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-5 shadow-card h-56" />
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-card h-56" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
        <div className="h-12 border-b border-border bg-secondary/40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-4 items-center border-b border-border/60 last:border-0">
            <div className="h-4 w-16 bg-secondary rounded" />
            <div className="h-4 flex-1 bg-secondary/60 rounded" />
            <div className="h-4 w-20 bg-secondary rounded" />
            <div className="h-4 w-24 bg-secondary rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
