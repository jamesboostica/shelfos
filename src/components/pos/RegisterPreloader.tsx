import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Initializing local database…",
  "Loading product catalog…",
  "Verifying shift session…",
  "Register ready",
];

export function RegisterPreloader({ done }: { done: boolean }) {
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 180);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!done) return;
    setStep(STEPS.length - 1);
    const a = setTimeout(() => setFading(true), 100);
    const b = setTimeout(() => setHidden(true), 400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [done]);

  if (hidden) return null;

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-[#0F172A] transition-opacity duration-500",
        fading ? "opacity-0" : "opacity-100",
      )}
    >
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#1E293B] shadow-2xl ring-1 ring-cyan-500/20">
          <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden="true">
            <rect
              x="8"
              y="11"
              width="32"
              height="8"
              rx="3"
              fill="#0EA5E9"
              className="animate-pulse"
              style={{ animationDelay: "0ms" }}
            />
            <rect
              x="8"
              y="22"
              width="32"
              height="8"
              rx="3"
              fill="#38BDF8"
              className="animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <rect
              x="8"
              y="33"
              width="20"
              height="6"
              rx="3"
              fill="#0EA5E9"
              opacity="0.6"
              className="animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </svg>
        </div>
        <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-cyan-400 opacity-75" />
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-cyan-400" />
      </div>

      <p className="text-2xl font-extrabold tracking-tight text-slate-50">ShelfOS</p>

      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-700">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 animate-[shimmer_1.5s_infinite] rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
      </div>

      <p className="font-mono text-xs text-slate-400">{STEPS[step]}</p>
    </div>
  );
}
