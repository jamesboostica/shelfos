import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useShelfOS } from "@/lib/shelfos-store";

/**
 * Blocks a page for cashiers: shows a locked notice and sends them back to
 * the register. Manager mode is unlocked with the supervisor PIN in the header.
 */
export function ManagerOnly({ children, area }: { children: React.ReactNode; area: string }) {
  const { role } = useShelfOS();
  const navigate = useNavigate();

  useEffect(() => {
    if (role === "manager") return;
    toast.error(`${area} is Manager only`, {
      description: "Unlock Manager mode with the supervisor PIN to continue.",
    });
    const t = setTimeout(() => void navigate({ to: "/pos" }), 900);
    return () => clearTimeout(t);
  }, [role, area, navigate]);

  if (role !== "manager") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-base font-bold text-navy">{area} is Manager only</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Returning you to the register. Tap Manager in the top bar and enter the supervisor PIN to
          open this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
