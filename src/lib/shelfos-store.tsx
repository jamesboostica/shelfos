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
import {
  drainSyncQueue,
  pullRemoteProducts,
  queueHealth,
  requestDurableStorage,
  storageHealth,
  type QueueHealth,
} from "./sync-service";
import { supabase } from "@/integrations/supabase/client";

export type Role = "cashier" | "manager";
export const MANAGER_PIN = "4875";
export const CASHIER_PIN = "1234";
export const CASHIER_ID = "Benson";
export const MANAGER_ID = "Mercy Lwiki";

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
  /** True once the 4-digit access PIN has been entered for this app session. */
  unlocked: boolean;
  unlock: () => void;
  /** Re-locks the register so the PIN screen appears again. */
  lock: () => void;

  /** Everything still held on this device: sales, shifts and stock changes. */
  queue: QueueHealth;
  /** True when the browser promised not to evict this till's stored work. */
  storagePersisted: boolean;
}

// Access rule: the signed-in session persists indefinitely — staff stay logged
// in. The 4-digit access PIN is required every time the app is opened,
// refreshed, or woken after sitting idle in the background.
export const ACCESS_PIN = CASHIER_PIN;
/** Idle time in the background after which the register re-locks. */
const IDLE_LOCK_MS = 5 * 60 * 1000;


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
  // Always starts locked: a fresh load or refresh must pass the PIN screen.
  const [unlocked, setUnlocked] = useState(false);

  const [queue, setQueue] = useState<QueueHealth>({
    pending: 0,
    oldestAt: null,
    oldestDays: 0,
    stuck: 0,
    lastError: null,
    byType: {},
  });
  const [storagePersisted, setStoragePersisted] = useState(false);
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
    const markSession = (signedIn: boolean) => {
      try {
        if (signedIn) localStorage.setItem(HAD_SESSION_KEY, "1");
        else localStorage.removeItem(HAD_SESSION_KEY);
      } catch {
        /* storage unavailable */
      }
      setHasCachedSession(signedIn);
    };
    // Offline-first: when there's no network, never wait on the session
    // check — open from the cached-session hint and reconcile when back online.
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) setAuthChecked(true);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user) {
          setUser(data.session.user);
          markSession(true);
          void loadProfile(data.session.user.id).catch(() => {});
        } else if (!offline) {
          markSession(false);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        // Network/storage failure — keep the cached-session decision.
        setAuthChecked(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const u = session?.user ?? null;
      if (event === "SIGNED_IN") {
        markSession(true);
        // Signing in just now counts as this session's access check.
        setUnlocked(true);
      } else if (event === "SIGNED_OUT") {

        markSession(false);
      }
      setUser(u);
      if (u) void loadProfile(u.id).catch(() => {});
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
    localStorage.removeItem(HAD_SESSION_KEY);
    setHasCachedSession(false);
    setUnlocked(false);
  }, []);

  const unlock = useCallback(() => setUnlocked(true), []);
  const lock = useCallback(() => setUnlocked(false), []);

  // App-state listener: re-lock whenever the app is backgrounded for longer
  // than the idle window, so waking it up asks for the PIN again.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        if (Date.now() - hiddenAt >= IDLE_LOCK_MS) setUnlocked(false);
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, []);


  useEffect(() => {
    const stored = localStorage.getItem("shelfos:role");
    if (stored === "manager" || stored === "cashier") setRoleState(stored);
    ensureSeeded().finally(() => setReady(true));
    void requestDurableStorage();
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

  // Offline health: how much work is held here, how old it is, and whether the
  // browser has promised to keep it. Refreshed every 20s and after each sync.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [q, s] = await Promise.all([queueHealth(), storageHealth()]);
      if (!alive) return;
      setQueue(q);
      setStoragePersisted(s.persisted);
    };
    void refresh().catch(() => {});
    const t = setInterval(() => void refresh().catch(() => {}), 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [queuedCount, syncing]);

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
      queue,
      storagePersisted,
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
      queue,
      storagePersisted,
    ],
  );

  return <ShelfOSContext.Provider value={value}>{children}</ShelfOSContext.Provider>;
}

export function useShelfOS() {
  const ctx = useContext(ShelfOSContext);
  if (!ctx) throw new Error("useShelfOS must be used inside ShelfOSProvider");
  return ctx;
}
