// Server functions for the secure error-report pipeline: sanitized reports
// land in public.error_reports (RLS-scoped), and staff can ask the AI model
// for a troubleshooting summary. Only technical details ever reach the model —
// never sales, product or stock data.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeText, type ErrorReportInput } from "@/lib/error-reports";

const SYSTEM_PROMPT = `You are the troubleshooting assistant for ShelfOS, an offline-first point-of-sale web app used by retail store staff (cashiers and a manager). Staff see an error screen and can describe what they were doing.

You receive ONLY sanitized technical details (route, error message, stack snippet, browser context, staff notes) — never business data. Produce a short, clear troubleshooting brief for a non-technical shop worker, in this exact structure:

WHAT LIKELY WENT WRONG
Two or three plain sentences.

STEPS TO TRY
Numbered, concrete steps (3-6). Include reload/retry steps where sensible, and note whether it is safe to keep selling and whether offline work is at risk.

WHEN TO ESCALATE
One or two sentences on when to hand it to the manager or stop using that feature.

Keep the tone calm and practical. Do not invent data, prices or records. Do not claim access to systems you cannot see.`;

function extractResponseText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    const t = (item as { type?: string }).type;
    if (t !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if ((c as { type?: string }).type === "output_text") {
        parts.push((c as { text?: string }).text ?? "");
      }
    }
  }
  return parts.join("\n").trim();
}

/** Staff-triggered: send sanitized error details to the AI model and get a
 * recovery brief. The summary is stored on the report for manager review. */
export const aiTroubleshoot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      localId?: string;
      route: string;
      message: string;
      stack?: string | null;
      context?: Record<string, unknown> | null;
      notes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const userLines = [
      `Failing route: ${sanitizeText(data.route, 200)}`,
      `Error message: ${sanitizeText(data.message, 2000)}`,
      data.stack ? `Stack (truncated):\n${sanitizeText(data.stack, 3000)}` : null,
      data.context ? `Browser context: ${sanitizeText(JSON.stringify(data.context), 800)}` : null,
      data.notes ? `Staff says: ${sanitizeText(data.notes, 2000)}` : null,
    ].filter(Boolean);

    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    let summary: string;
    try {
      const response = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM_PROMPT,
        input: [
          {
            role: "user",
            content: userLines.join("\n\n"),
          },
        ],
        max_output_tokens: 900,
      });
      summary = extractResponseText(response.output);
      if (!summary) throw new Error("The AI returned an empty answer.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new Error(`The troubleshooting assistant is unavailable right now (${message}).`);
    }

    if (data.localId) {
      const { error } = await supabase
        .from("error_reports")
        .update({ ai_summary: summary })
        .eq("local_id", sanitizeText(data.localId, 100));
      if (error) throw new Error(error.message);
    }

    return { summary };
  });

/** Called automatically from the recovery screen. Stores the sanitized report. */
export const submitErrorReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ErrorReportInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      local_id: sanitizeText(data.local_id, 100),
      route: sanitizeText(data.route, 200),
      message: sanitizeText(data.message, 2000),
      stack: sanitizeText(data.stack, 6000) || null,
      user_agent: sanitizeText(data.user_agent, 300) || null,
      screen: sanitizeText(data.screen, 40) || null,
      online: data.online !== false,
      staff_notes: sanitizeText(data.staff_notes, 2000) || null,
      extra_context: (data.extra_context ?? {}) as Record<string, unknown>,
      reported_at: data.reported_at,
    };
    const { error } = await supabase
      .from("error_reports")
      .upsert(row, { onConflict: "user_id,local_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manager review list: managers see every report, staff see their own. */
export const listErrorReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isManager, error: roleError } = await supabase.rpc("is_manager", {
      _user_id: userId,
    });
    if (roleError) throw new Error(roleError.message);

    const query = supabase
      .from("error_reports")
      .select(
        "id, user_id, local_id, route, message, stack, user_agent, screen, online, staff_notes, ai_summary, status, reported_at",
      )
      .order("reported_at", { ascending: false })
      .limit(50);
    const { data, error } = isManager ? await query : await query.eq("user_id", userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Manager action: mark a report resolved. */
export const resolveErrorReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; localId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isManager, error: roleError } = await supabase.rpc("is_manager", {
      _user_id: userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isManager) throw new Error("Only a manager can resolve reports.");

    const { error } = await supabase
      .from("error_reports")
      .update({ status: "resolved" })
      .eq("user_id", data.userId)
      .eq("local_id", data.localId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
