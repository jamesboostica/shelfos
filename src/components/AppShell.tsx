import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { BarChart3, CloudOff, Cloud, LogOut, Package, RefreshCw, ScanLine, User, Wallet, Lock } from "lucide-react";
import { ShelfOSLogo } from "@/components/brand/Logo";
import { PinDialog } from "@/components/PinDialog";
import { RegisterPreloader } from "@/components/pos/RegisterPreloader";
import { DailyPinLock } from "@/components/auth/DailyPinLock";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useShelfOS } from "@/lib/shelfos-store";
import { clockTime, kes } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/pos", label: "Register", icon: ScanLine, managerOnly: false },
  { to: "/inventory", label: "Inventory", icon: Package, managerOnly: true },
  { to: "/shifts", label: "Shifts", icon: Wallet, managerOnly: false },
  { to: "/dashboard", label: "Reports", icon: BarChart3, managerOnly: true },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, setRole, online, syncing, queuedCount, pendingOrders, syncNow, shift, user, profile, authChecked, signOut, dailyUnlocked, unlockDaily } =
    useShelfOS();
  const [pinOpen, setPinOpen] = useState(false);
  const [now, setNow] = useState(() => clockTime());
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setNow(clockTime()), 15000);
    return () => clearInterval(t);
  }, []);

  // Public routes that never require a signed-in user.
  const isPublicRoute = pathname === "/login" || pathname === "/reset-password";

  // Route guard: everything except public routes requires a signed-in user.
  useEffect(() => {
    if (!isPublicRoute && authChecked && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [isPublicRoute, authChecked, user, navigate]);

  const synced = online && queuedCount === 0;
  const queuedValue = pendingOrders.reduce((s, o) => s + o.total_amount, 0);

  // Public screens render bare — no register chrome around them.
  if (isPublicRoute) return <>{children}</>;

  // While the session is being verified (or a signed-out user is being sent
  // to /login) hold the register behind the preloader.
  if (!authChecked || !user) return <RegisterPreloader done={false} />;

  const displayName =
    profile?.full_name || (user?.user_metadata?.["full_name"] as string | undefined) || user?.email || "";
  const avatarUrl =
    profile?.avatar_url || (user?.user_metadata?.["avatar_url"] as string | undefined);

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6">
          <ShelfOSLogo />

          <div className="order-3 w-full lg:order-none lg:mx-auto lg:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex h-9 w-full items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold lg:w-auto",
                    syncing
                      ? "border-brand/30 bg-brand-soft text-accent-foreground"
                      : synced
                        ? "border-success/30 bg-success-soft text-success"
                        : "border-warning/30 bg-warning-soft text-warning",
                  )}
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span className="num">Syncing {queuedCount} order{queuedCount === 1 ? "" : "s"}…</span>
                    </>
                  ) : synced ? (
                    <>
                      <span className="pulse-dot h-2 w-2 rounded-full bg-success text-success" />
                      <Cloud className="h-3.5 w-3.5" />
                      Online (Cloud Synced)
                    </>
                  ) : (
                    <>
                      <span className="pulse-dot h-2 w-2 rounded-full bg-warning text-warning" />
                      <CloudOff className="h-3.5 w-3.5" />
                      <span className="num">Offline Mode ({queuedCount} pending sync)</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-72">
                <p className="text-sm font-bold text-navy">Pending sync</p>
                <p className="num mt-0.5 text-xs text-muted-foreground">
                  {queuedCount} order{queuedCount === 1 ? "" : "s"} · {kes(queuedValue)} queued
                </p>
                <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                  {pendingOrders.map((o) => (
                    <div key={o.local_id} className="num flex justify-between text-xs">
                      <span className="text-muted-foreground">{o.local_id}</span>
                      <span className="font-semibold text-navy">{kes(o.total_amount)}</span>
                    </div>
                  ))}
                  {queuedCount === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Everything on this till is backed up.
                    </p>
                  )}
                </div>
                <Button
                  className="touch-target mt-3 w-full"
                  disabled={!online || queuedCount === 0 || syncing}
                  onClick={syncNow}
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
                  Sync now
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span
              className={cn(
                "hidden rounded-full border px-3 py-1.5 text-xs font-semibold sm:inline-flex",
                shift
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {shift ? "Active Register" : "No Open Shift"}
            </span>

            <div className="flex items-center rounded-full border border-border bg-secondary p-1">
              <button
                onClick={() => setRole("cashier")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  role === "cashier" ? "bg-navy text-navy-foreground" : "text-muted-foreground",
                )}
              >
                Cashier
              </button>
              <button
                onClick={() => (role === "manager" ? undefined : setPinOpen(true))}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  role === "manager" ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                )}
              >
                {role !== "manager" && <Lock className="h-3 w-3" />}
                Manager
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-8 w-8 rounded-full border border-border object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-navy-foreground">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-32 truncate text-sm font-semibold text-navy md:inline">
                  {displayName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="touch-target text-muted-foreground hover:text-navy"
                  onClick={() => void handleSignOut()}
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="ml-1 hidden lg:inline">Log Out</span>
                </Button>
              </div>
            ) : (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="touch-target gap-1.5 text-muted-foreground hover:text-navy"
                title="Sign in"
              >
                <Link to="/login">
                  <User className="h-4 w-4" />
                  <span className="hidden lg:inline">Sign in</span>
                </Link>
              </Button>
            )}

            <span className="num hidden text-sm font-semibold text-navy sm:inline">{now}</span>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border bg-navy px-2 py-1.5 lg:px-4">
          {NAV.filter((n) => !n.managerOnly || role === "manager").map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                className={cn(
                  "touch-target shrink-0 rounded-lg px-4 text-sm font-semibold text-navy-foreground/70 hover:bg-navy-muted hover:text-navy-foreground",
                  active && "bg-brand text-brand-foreground hover:bg-brand hover:text-brand-foreground",
                )}
              >
                <Link to={item.to}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>
      </header>

      <main>{children}</main>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} onSuccess={() => setRole("manager")} />
    </div>
  );
}
