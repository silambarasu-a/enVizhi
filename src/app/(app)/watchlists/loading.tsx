export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 animate-pulse space-y-8">
      <header className="space-y-2">
        <div className="h-3 w-20 bg-secondary rounded" />
        <div className="h-9 w-64 bg-secondary rounded" />
        <div className="h-4 w-96 bg-secondary rounded" />
      </header>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="h-10 bg-secondary/60 rounded-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
            <div className="h-5 w-32 bg-secondary rounded" />
            <div className="h-3 w-20 bg-secondary/60 rounded" />
            <div className="flex gap-1.5 mt-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-5 w-14 bg-secondary/60 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
