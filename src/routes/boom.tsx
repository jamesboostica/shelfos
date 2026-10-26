import { createFileRoute } from "@tanstack/react-router";

// TEMP verification route: throws immediately on render so the root recovery
// boundary captures a real route error. REMOVE after the offline test.
function BoomPage() {
  throw new Error("Simulated offline till failure (verification test)");
}

export const Route = createFileRoute("/boom")({
  component: BoomPage,
});
