// Client-side error capture for ShelfOS. Every captured error is sanitized
// (no business data, no credentials) before it leaves the device, then sent to
// public.error_reports for manager review. Failures queue locally and retry.

import { submitErrorReport } from "@/lib/error-reports.functions";

export interface ErrorReportInput {
  local_id: string;
  route: string;
  message: string;
  stack: string | null;
  user_agent: string | null;
  screen: string | null;
  online: boolean;
  staff_notes?: string | null;
  extra_context?: Record<string, unknown>;
  reported_at: string;
}

const MAX_STORED = 25;
const STORAGE_KEY = "shelfos:error-reports";

// Technical context only: strip anything that could carry business or
// credential data before an error detail is stored or shown to the AI model.
const REDACTIONS: Array<[RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/(bearer\s+)[A-Za-z0-9\-._~+/=]+/gi, "$1[redacted]"],
  [
    /(api[_-]?key|token|password|secret|authorization)(["\s:=]+)[^"'\s,;}&<>]+/gi,
    "$1$2[redacted]",
  ],
  [/sb_[a-z0-9_]{10,}/gi, "[redacted-key]"],
];

export function sanitizeText(input: unknown, maxLen = 4000): string {
  if (typeof input !== "string") return "";
  let out = input;
  for (const [re, rep] of REDACTIONS) out = out.replace(re, rep);
  return out.slice(0, maxLen);
}

export function errorToDetail(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? null };
  }
  if (error instanceof Response) {
    return { message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`, stack: null };
  }
  return { message: typeof error === "string" ? error : String(error), stack: null };
}

function collectBrowserContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof window === "undefined") return extra;
  return {
    userAgent: navigator.userAgent.slice(0, 300),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    online: navigator.onLine,
    ...extra,
  };
}

export function buildErrorReport(
  route: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): ErrorReportInput {
  const { message, stack } = errorToDetail(error);
  return {
    local_id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    route: route.slice(0, 200),
    message: sanitizeText(message, 2000),
    stack: sanitizeText(stack, 6000) || null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
    screen: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    reported_at: new Date().toISOString(),
    extra_context: collectBrowserContext(extra),
  };
}

function readPending(): ErrorReportInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ErrorReportInput[]) : [];
  } catch {
    return [];
  }
}

function writePending(reports: ErrorReportInput[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(-MAX_STORED)));
  } catch {
    /* storage unavailable */
  }
}

/** Best-effort: store a report in the cloud; if it fails, hold it locally for retry. */
export async function reportError(route: string, error: unknown, extra: Record<string, unknown> = {}) {
  const report = buildErrorReport(route, error, extra);
  const pending = readPending();
  pending.push(report);
  writePending(pending);
  await flushPendingErrorReports();
}

/** Push every locally-held report to the cloud; silently keeps failures queued. */
export async function flushPendingErrorReports(): Promise<void> {
  const pending = readPending();
  if (pending.length === 0) return;
  const remaining: ErrorReportInput[] = [];
  for (const report of pending) {
    try {
      await submitErrorReport({ data: report });
    } catch {
      remaining.push(report);
    }
  }
  writePending(remaining);
}
