import { useEffect, useState, type ReactNode } from "react";
import { RegisterPreloader } from "@/components/pos/RegisterPreloader";

/** IndexedDB only exists in the browser: render the register shell after hydration. */
export function ClientGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <RegisterPreloader done={false} />;
  }
  return <>{children}</>;
}
