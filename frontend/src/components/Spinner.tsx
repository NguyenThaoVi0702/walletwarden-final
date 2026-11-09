export function Spinner({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-navy/70">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-green border-t-transparent"
      />
      {label}
    </div>
  );
}
