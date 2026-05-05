export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 animate-pulse space-y-6">
      <div className="h-3 w-32 bg-secondary rounded" />

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card flex items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-secondary rounded" />
          <div className="h-5 w-56 bg-secondary/60 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-9 w-32 bg-secondary rounded" />
          <div className="h-3 w-24 bg-secondary/60 rounded ml-auto" />
        </div>
      </div>

      {/* Chart + Lynch */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-card h-96" />
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-3">
          <div className="h-3 w-16 bg-secondary rounded" />
          <div className="h-6 w-40 bg-secondary rounded" />
          <div className="h-4 w-full bg-secondary/60 rounded mt-3" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="h-16 bg-secondary/60 rounded-lg" />
            <div className="h-16 bg-secondary/60 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Fundamentals */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-secondary rounded" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 w-full bg-secondary/60 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
