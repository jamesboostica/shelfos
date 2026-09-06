import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { BarChart3, CloudOff, Cloud, Package, ScanLine, Wallet, Lock } from "lucide-react";
import { ShelfOSLogo } from "@/components/brand/Logo";
import { PinDialog } from "@/components/PinDialog";
import { Button } from "@/components/ui/button";
import { useShelfOS } from "@/lib/shelfos-store";
import { clockTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/pos", label: "Register", icon: ScanLine, managerOnly: false },
  { to: "/inventory", label: "Inventory", icon: Package, managerOnly: false },
  { to: "/shifts", label: "Shifts", icon: Wallet, managerOnly: false },
  { to: "/dashboard", label: "Reports", icon: BarChart3, managerOnly: true },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, setRole, online, queuedCount, shift } = useShelfOS();
  const [pinOpen, setPinOpen] = useState(false);
  const [now, setNow] = useState(() => clockTime());
  const { pathname } = useLocation();

  useEffect(() => {
    const t = setInterval(() => setNow(clockTime()), 15000);
    return () => clearInterval(t);
  }, []);

  const synced = online && queuedCount === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6">
          <ShelfOSLogo />

          <div className="order-3 w-full lg:order-none lg:mx-auto lg:w-auto">
            <div
              className={cn(
                "flex h-9 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold",
                synced
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-warning/30 bg-warning-soft text-warning",
              )}
            >
              {synced ? (
                <>
                  <span className="pulse-dot h-2 w-2 rounded-full bg-success text-success" />
                  <Cloud className="h-3.5 w-3.5" />
                  Online (Synced)
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5" />
                  <span className="num">
                    Offline Mode ({queuedCount} order{queuedCount === 1 ? "" : "s"} queued for sync)
                  </span>
                </>
              )}
            </div>
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
