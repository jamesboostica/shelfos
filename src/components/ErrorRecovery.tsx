import { useEffect, useState } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { LifeBuoy, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { ShelfOSLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { reportError, flushPendingErrorReports } from "@/lib/error-reports";
import { aiTroubleshoot } from "@/lib/error-reports.functions";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Recovery screen shown whenever a route fails — never a blank screen.
 * Captures a sanitized error report, offers retry/reload, and lets staff ask
 * the AI assistant for a troubleshooting brief with recovery steps.
 */
export function ErrorRecovery({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { pathname } = router.state.location;

  const [notes, setNotes] = useState("");
  const [thinking, setThinking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    reportLovableError(error, { boundary: "error_recovery_screen" });
    void reportError(pathname, error, { boundary: "route" })
      .then(() => setReported(true))
      .catch(() => setReported(false));
  }, [error, pathname]);

  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const askForHelp = async () => {
    setThinking(true);
    setHelpError(null);
    setSummary(null);
    try {
      const { summary: result } = await aiTroubleshoot({
        data: {
          route: pathname,
          message: detail,
          stack: stack ?? null,
          notes: notes.trim() || null,
        },
      });
      setSummary(result);
    } catch (err) {
      setHelpError(err instanceof Error ? err.message : "Could not reach the assistant.");
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex justify-center">
          <ShelfOSLogo />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-navy">This page hit a problem</h1>
              <p className="text-sm text-muted-foreground">
                Nothing is lost — your sales and stock stay saved on this till.
              </p>
            </div>
          </div>

          <p className="mt-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Page: <span className="ml-1 font-mono text-navy">{pathname}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="touch-target flex-1"
              onClick={() => {
                router.invalidate();
                router.history.back();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              className="touch-target flex-1"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload app
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {reported
              ? "This problem was recorded for the manager to review."
              : "Report saves automatically when the till is online."}
          </p>

          <details className="mt-4 rounded-lg border border-border bg-secondary px-3 py-2">
            <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Technical details
            </summary>
            <p className="mt-2 break-words font-mono text-xs text-navy">{detail}</p>
            {stack && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-muted-foreground">
                {stack.slice(0, 3000)}
              </pre>
            )}
          </details>

          <div className="mt-4 rounded-lg border border-brand/30 bg-brand-soft/40 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-navy">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
              Stuck? Describe what happened and get guided steps
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I was checking out a customer and the screen went white."
              rows={3}
              maxLength={2000}
              className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <Button
              className="touch-target mt-2 w-full"
              disabled={thinking}
              onClick={() => void askForHelp()}
            >
              {thinking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Working on it…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get troubleshooting help
                </>
              )}
            </Button>
            {helpError && <p className="mt-2 text-xs font-medium text-warning">{helpError}</p>}
            {summary && (
              <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy">{summary}</p>
                <Button
                  variant="outline"
                  className="touch-target mt-3 w-full"
                  onClick={() => void flushPendingErrorReports().then(() => window.location.reload())}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Done — reload the app
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
