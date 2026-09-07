import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShelfOSLogo } from "@/components/brand/Logo";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — ShelfOS" },
      {
        name: "description",
        content: "Sign in to ShelfOS with email and password or Google to open the register, manage inventory, and review store reports.",
      },
      { property: "og:title", content: "Sign In — ShelfOS" },
      {
        property: "og:description",
        content: "Email, password, or Google sign-in for the ShelfOS offline-first retail POS.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const go = () => {
      if (active) void navigate({ to: "/pos", replace: true });
    };
    // OAuth returns here with tokens in the URL; the client hydrates the session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) go();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShelfOSLogo />
          <p className="text-sm text-slate-500">
            The offline-first operating system for modern physical retail.
          </p>
        </div>
        <div className="mt-8">
          <GoogleLoginButton />
        </div>
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <EmailPasswordForm />
        <p className="mt-6 text-center text-xs text-slate-400">
          Staff access is managed by your store manager. The first account to sign in becomes the
          manager.
        </p>
      </div>
    </div>
  );
}
