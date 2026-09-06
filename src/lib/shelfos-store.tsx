import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureSeeded, getDb, type Shift } from "./db";

export type Role = "cashier" | "manager";
export const MANAGER_PIN = "1234";
export const CASHIER_ID = "Amina W.";

interface Ctx {
  role: Role;
  setRole: (r: Role) => void;
  online: boolean;
  queuedCount: number;
  shift: Shift | undefined;
  ready: boolean;
}

const ShelfOSContext = createContext<Ctx | null>(null);

export function ShelfOSProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("cashier");
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("shelfos:role");
    if (stored === "manager" || stored === "cashier") setRoleState(stored);
    ensureSeeded().finally(() => setReady(true));
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const queuedCount = useLiveQuery(() => getDb().orders.where("synced").equals(0).count(), [], 0);
  const shift = useLiveQuery(
    () => getDb().shifts.where("status").equals("open").first(),
    [],
    undefined,
  );

  const value = useMemo<Ctx>(
    () => ({
      role,
      setRole: (r: Role) => {
        setRoleState(r);
        localStorage.setItem("shelfos:role", r);
      },
      online,
      queuedCount: queuedCount ?? 0,
      shift,
      ready,
    }),
    [role, online, queuedCount, shift, ready],
  );

  return <ShelfOSContext.Provider value={value}>{children}</ShelfOSContext.Provider>;
}

export function useShelfOS() {
  const ctx = useContext(ShelfOSContext);
  if (!ctx) throw new Error("useShelfOS must be used inside ShelfOSProvider");
  return ctx;
}
