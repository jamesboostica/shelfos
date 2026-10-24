import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  aiTroubleshoot,
  listErrorReports,
  resolveErrorReport,
} from "@/lib/error-reports.functions";
import type { ErrorReportInput } from "@/lib/error-reports";

type ReportRow = Omit<ErrorReportInput, "extra_context" | "staff_notes"> & {
  id: string;
  user_id: string;
  staff_notes: string | null;
  ai_summary: string | null;
  status: string;
};

/**
 * Manager-only review of the sanitized error reports recorded by staff
 * devices, with the AI troubleshooting briefs attached.
 */
export function ErrorReportsCard() {
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReports((await listErrorReports()) as ReportRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load error reports.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const explain = async (report: ReportRow) => {
    setExplaining(report.local_id);
    try {
      await aiTroubleshoot({
        data: {
          localId: report.local_id,
          route: report.route,
          message: report.message,
          stack: report.stack,
          notes: report.staff_notes,
        },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the assistant.");
    } finally {
      setExplaining(null);
    }
  };

  const resolve = async (report: ReportRow) => {
    try {
      await resolveErrorReport({ data: { userId: report.user_id, localId: report.local_id } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the report.");
    }
  };

  const open = (reports ?? []).filter((r) => r.status !== "resolved");

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-navy">Error reports from staff</h2>
        <Button variant="outline" size="sm" className="touch-target" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="mb-2 text-xs font-medium text-warning">{error}</p>}
      {reports === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : open.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open error reports. All clear.</p>
      ) : (
        <ul className="space-y-2">
          {open.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-secondary px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-navy">{r.route}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.reported_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {!r.online && (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                    offline
                  </span>
                )}
              </div>
              <p className="mt-1 break-words text-sm text-navy">{r.message}</p>
              {r.staff_notes && (
                <p className="mt-1 text-xs italic text-muted-foreground">“{r.staff_notes}”</p>
              )}
              {r.ai_summary ? (
                <div className="mt-2 rounded-lg border border-brand/30 bg-brand-soft/40 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
                    <Sparkles className="h-3 w-3" /> AI recovery brief
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-navy">
                    {r.ai_summary}
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={explaining === r.local_id}
                  onClick={() => void explain(r)}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {explaining === r.local_id ? "Working…" : "Explain with AI"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 text-muted-foreground hover:text-success"
                onClick={() => void resolve(r)}
              >
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                Mark resolved
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
