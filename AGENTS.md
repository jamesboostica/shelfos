<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Route errors render the shared recovery boundary (`src/components/ErrorRecovery.tsx`), wired as the root `errorComponent` and the router `defaultErrorComponent` — no route may show a blank screen on error.
- Error reports are sanitized client-side in `src/lib/error-reports.ts` (route, message, truncated stack, browser context only — never sales, product, stock or credential data), queued in localStorage when offline, and stored in `public.error_reports`; managers review them on the Reports page.
- AI troubleshooting goes through `@lovable.dev/ai-gateway` `generateResponse` with model `openai/gpt-6-astra`, dynamically imported inside the server-function handler.
