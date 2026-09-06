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
import type { User } from "@supabase/supabase-js";
import { ensureSeeded, getDb, type Order, type Shift } from "./db";
import { drainSyncQueue, pullRemoteProducts } from "./sync-service";
import { supabase } from "@/integrations/supabase/client";

export type Role = "cashier" | "manager";
export const MANAGER_PIN = "1234";
export const CASHIER_ID = "Amina W.";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: Role;
}

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
  user: User | null;
  profile: AuthProfile | null;
  signOut: () => Promise<void>;
}

const ShelfOSContext = createContext<Ctx | null>(null);

export function ShelfOSProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("cashier");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
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

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      const p = data as AuthProfile;
      setProfile(p);
      // The account role is authoritative: a cashier login locks the till to cashier mode.
      setRoleState(p.role === "manager" ? "manager" : "cashier");
      localStorage.setItem("shelfos:role", p.role === "manager" ? "manager" : "cashier");
    }
  }, []);

  // Auth listener: keep the signed-in user and their profile role in sync.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        void loadProfile(data.user.id);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) void loadProfile(u.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoleState("cashier");
    localStorage.setItem("shelfos:role", "cashier");
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
      user,
      profile,
      signOut,
    }),
    [role, online, syncing, queuedCount, pendingOrders, runSync, shift, ready, user, profile, signOut],
  );

  return <ShelfOSContext.Provider value={value}>{children}</ShelfOSContext.Provider>;
}

export function useShelfOS() {
  const ctx = useContext(ShelfOSContext);
  if (!ctx) throw new Error("useShelfOS must be used inside ShelfOSProvider");
  return ctx;
}
