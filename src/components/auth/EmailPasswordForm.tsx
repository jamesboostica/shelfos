import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Mode = "signin" | "signup";

export function EmailPasswordForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const trimmed = email.trim();
    if (!trimmed || password.length < 6) {
      toast.error("Check your details", {
        description: "Enter your email and a password of at least 6 characters.",
      });
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created");
        } else {
          setSentTo(trimmed);
          toast.success("Confirm your email", {
            description: "We sent you a confirmation link. Open it to finish creating your account.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(mode === "signup" ? "Could not create the account" : "Sign in failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-sm font-semibold text-slate-900">Check your inbox</p>
        <p className="mt-1 text-xs text-slate-500">
          We sent a confirmation link to <span className="font-mono">{sentTo}</span>. Open it, then
          come back and sign in.
        </p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setMode("signin");
            setPassword("");
          }}
          className="mt-4 h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@store.co.ke"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-500">
        {mode === "signup" ? "Already have an account?" : "No account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="font-semibold text-sky-700 underline-offset-2 hover:underline"
        >
          {mode === "signup" ? "Sign in instead" : "Create one"}
        </button>
      </p>
    </form>
  );
}
