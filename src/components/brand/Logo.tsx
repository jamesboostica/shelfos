import { cn } from "@/lib/utils";

/** The Modular S-Shelf mark. Mono variant renders solid black for thermal receipts. */
export function ShelfMark({
  className,
  mono = false,
}: {
  className?: string;
  mono?: boolean;
}) {
  const cyan = mono ? "#000000" : "#0EA5E9";
  const white = mono ? "#000000" : "#FFFFFF";
  const bright = mono ? "#000000" : "#38BDF8";
  return (
    <svg viewBox="0 0 200 200" fill="none" className={cn("receipt-mark", className)} aria-hidden>
      <rect x="52" y="52" width="96" height="18" rx="9" fill={cyan} />
      <rect x="52" y="52" width="18" height="52" rx="9" fill={cyan} />
      <rect x="52" y="91" width="76" height="18" rx="9" fill={white} />
      <rect x="130" y="91" width="18" height="57" rx="9" fill={bright} />
      <rect x="74" y="130" width="74" height="18" rx="9" fill={bright} />
      <circle cx="140" cy="61" r="7" fill={bright} />
    </svg>
  );
}

export function ShelfOSLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex select-none items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy p-1.5 shadow-card">
        <ShelfMark className="h-full w-full" />
      </div>
      {!compact && (
        <div className="flex items-baseline tracking-tight">
          <span className="text-xl font-bold text-navy">Shelf</span>
          <span className="ml-0.5 text-xl font-extrabold text-brand">OS</span>
        </div>
      )}
    </div>
  );
}
