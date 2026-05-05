export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 animate-pulse">
      <header className="mb-8 space-y-2">
        <div className="h-3 w-20 bg-secondary rounded" />
        <div className="h-9 w-72 bg-secondary rounded" />
        <div className="h-4 w-96 bg-secondary rounded" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Filter sidebar */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-secondary rounded" />
              <div className="h-9 bg-secondary/60 rounded-md" />
            </div>
          ))}
        </div>

        {/* Results table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="h-4 w-24 bg-secondary rounded" />
            <div className="h-7 w-20 bg-secondary rounded" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-4 flex gap-4 items-center">
                <div className="h-4 w-16 bg-secondary rounded" />
                <div className="h-4 flex-1 bg-secondary/60 rounded" />
                <div className="h-4 w-12 bg-secondary rounded" />
                <div className="h-4 w-12 bg-secondary rounded" />
                <div className="h-4 w-16 bg-secondary rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
