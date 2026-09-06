import { useEffect, useState, type ReactNode } from "react";

/** IndexedDB only exists in the browser: render the register shell after hydration. */
export function ClientGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="num text-sm text-muted-foreground">Loading register…</p>
      </div>
    );
  }
  return <>{children}</>;
}
