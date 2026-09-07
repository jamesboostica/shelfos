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
export const MANAGER_PIN = "4875";
export const CASHIER_PIN = "1234";
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
  authChecked: boolean;
  /** Synchronous hint that this device previously signed in (pre-verification). */
  hasCachedSession: boolean;
  signOut: () => Promise<void>;
  /** True once today's 4-digit access PIN has been entered on this device. */
  dailyUnlocked: boolean;
  unlockDaily: () => void;
}

// Access rule: the signed-in session persists indefinitely — staff stay logged
// in. Once per calendar day the register asks for the 4-digit access PIN.
const PIN_DAY_KEY = "shelfos:pin-day";
export const ACCESS_PIN = CASHIER_PIN;

// Cheap synchronous hint that this device has a signed-in session, so the
// register can open instantly while the real session is verified in the
// background (the preview brokers storage over postMessage, which is slow).
const HAD_SESSION_KEY = "shelfos:had-session";

function hadSessionHint(): boolean {
  try {
    return localStorage.getItem(HAD_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function today(): string {
  return new Date().toDateString();
}

function pinUnlockedToday(): boolean {
  try {
    return localStorage.getItem(PIN_DAY_KEY) === today();
  } catch {
    return false;
  }
}

const ShelfOSContext = createContext<Ctx | null>(null);

export function ShelfOSProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("cashier");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasCachedSession, setHasCachedSession] = useState(hadSessionHint);
  const [dailyUnlocked, setDailyUnlocked] = useState(false);
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
    setDailyUnlocked(pinUnlockedToday());
    const markSession = (signedIn: boolean) => {
      try {
        if (signedIn) localStorage.setItem(HAD_SESSION_KEY, "1");
        else localStorage.removeItem(HAD_SESSION_KEY);
      } catch {
        /* storage unavailable */
      }
      setHasCachedSession(signedIn);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
        markSession(true);
        void loadProfile(data.session.user.id);
      } else {
        markSession(false);
      }
      setAuthChecked(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const u = session?.user ?? null;
      if (event === "SIGNED_IN") {
        markSession(true);
        // Signing in counts as today's access check.
        try {
          localStorage.setItem(PIN_DAY_KEY, today());
        } catch {
          /* storage unavailable */
        }
        setDailyUnlocked(true);
      } else if (event === "SIGNED_OUT") {
        markSession(false);
      }
      setUser(u);
      if (u) void loadProfile(u.id);
      else setProfile(null);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoleState("cashier");
    localStorage.setItem("shelfos:role", "cashier");
    localStorage.removeItem(PIN_DAY_KEY);
    localStorage.removeItem(HAD_SESSION_KEY);
    setHasCachedSession(false);
    setDailyUnlocked(false);
  }, []);

  const unlockDaily = useCallback(() => {
    try {
      localStorage.setItem(PIN_DAY_KEY, today());
    } catch {
      /* storage unavailable */
    }
    setDailyUnlocked(true);
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
      authChecked,
      hasCachedSession,
      signOut,
      dailyUnlocked,
      unlockDaily,
    }),
    [
      role,
      online,
      syncing,
      queuedCount,
      pendingOrders,
      runSync,
      shift,
      ready,
      user,
      profile,
      authChecked,
      hasCachedSession,
      signOut,
      dailyUnlocked,
      unlockDaily,
    ],
  );

  return <ShelfOSContext.Provider value={value}>{children}</ShelfOSContext.Provider>;
}

export function useShelfOS() {
  const ctx = useContext(ShelfOSContext);
  if (!ctx) throw new Error("useShelfOS must be used inside ShelfOSProvider");
  return ctx;
}
