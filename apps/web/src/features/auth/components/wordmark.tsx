export function Wordmark() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-5xl font-bold uppercase leading-none tracking-tight">
        Stryde
      </p>
      {/* The single accent mark under the wordmark (UI_DESIGN.md §5.1). */}
      <span className="h-1 w-10 rounded-full bg-brand" aria-hidden />
    </div>
  )
}
