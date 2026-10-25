import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY verification route — throws on render to exercise the error
// recovery boundary. Deleted after the check.
export const Route = createFileRoute("/boom")({
  head: () => ({ meta: [{ title: "Boom — ShelfOS recovery test" }] }),
  component: () => {
    throw new Error("Simulated register failure for recovery-screen verification");
  },
});
