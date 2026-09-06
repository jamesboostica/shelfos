import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureSeeded, getDb, type Order, type Shift } from "./db";
import { drainSyncQueue, pullRemoteProducts } from "./sync-service";

export type Role = "cashier" | "manager";
export const MANAGER_PIN = "1234";
export const CASHIER_ID = "Amina W.";

interface Ctx {
  role: Role;
  setRole: (r: Role) => void;
  online: boolean;
  syncing: boolean;
  queuedCount: number;
  pendingOrders: Order[];
  syncNow: () => void;
  shift: Shift | undefined;
  ready: boolean;
}

const ShelfOSContext = createContext<Ctx | null>(null);

export function ShelfOSProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("cashier");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);
  const busy = useRef(false);

  const pendingOrders = useLiveQuery(
    () => getDb().orders.where("synced").equals(0).toArray(),
    [],
    [] as Order[],
  );
  const queuedCount = pendingOrders?.length ?? 0;

  const runSync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    setSyncing(true);
    try {
      await drainSyncQueue();
      await pullRemoteProducts();
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("shelfos:role");
    if (stored === "manager" || stored === "cashier") setRoleState(stored);
    ensureSeeded().finally(() => setReady(true));
    const sync = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void runSync();
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [runSync]);

  // Heartbeat: retry every 30s while there is queued work.
  useEffect(() => {
    if (!online || queuedCount === 0) return;
    const t = setInterval(() => void runSync(), 30000);
    return () => clearInterval(t);
  }, [online, queuedCount, runSync]);

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
      syncing,
      queuedCount,
      pendingOrders: pendingOrders ?? [],
      syncNow: () => void runSync(),
      shift,
      ready,
    }),
    [role, online, syncing, queuedCount, pendingOrders, runSync, shift, ready],
  );

  return <ShelfOSContext.Provider value={value}>{children}</ShelfOSContext.Provider>;
}

export function useShelfOS() {
  const ctx = useContext(ShelfOSContext);
  if (!ctx) throw new Error("useShelfOS must be used inside ShelfOSProvider");
  return ctx;
}
