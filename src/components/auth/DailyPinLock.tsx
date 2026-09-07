import { useState } from "react";
import { Delete, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCESS_PIN } from "@/lib/shelfos-store";
import { cn } from "@/lib/utils";

/**
 * Once-a-day access check. The staff account stays signed in permanently; this
 * screen only confirms the person at the till knows today's 4-digit PIN.
 */
export function DailyPinLock({ name, onUnlock }: { name?: string; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const press = (digit: string) => {
    setError(false);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (next === ACCESS_PIN) {
        setPin("");
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setPin(""), 350);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0F172A] px-6 py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E293B] ring-1 ring-cyan-500/25">
        <Lock className="h-7 w-7 text-cyan-400" />
      </div>
      <div className="text-center">
        <p className="text-xl font-extrabold tracking-tight text-slate-50">Register locked</p>
        <p className="mt-1 text-sm text-slate-400">
          {name ? `Welcome back, ${name}. ` : ""}Enter today&apos;s 4-digit access PIN.
        </p>
      </div>

      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex h-14 w-11 items-center justify-center rounded-lg border-2 bg-slate-800",
              error ? "border-red-500" : pin.length > i ? "border-cyan-400" : "border-slate-700",
            )}
          >
            <span className="font-mono text-2xl leading-none text-slate-50">{pin.length > i ? "•" : ""}</span>
          </div>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-red-400">Incorrect PIN. Try again.</p>}

      <div className="grid w-full max-w-xs grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Button
            key={d}
            variant="outline"
            className="h-16 border-slate-700 bg-slate-800 font-mono text-xl text-slate-50 hover:bg-slate-700"
            onClick={() => press(d)}
          >
            {d}
          </Button>
        ))}
        <Button variant="ghost" className="h-16 text-slate-300 hover:bg-slate-800" onClick={() => setPin("")}>
          Clear
        </Button>
        <Button
          variant="outline"
          className="h-16 border-slate-700 bg-slate-800 font-mono text-xl text-slate-50 hover:bg-slate-700"
          onClick={() => press("0")}
        >
          0
        </Button>
        <Button
          variant="ghost"
          className="h-16 text-slate-300 hover:bg-slate-800"
          onClick={() => setPin(pin.slice(0, -1))}
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
