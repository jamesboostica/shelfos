import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorRecovery } from "@/components/ErrorRecovery";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Any route error without its own boundary shows the recovery screen —
    // staff never hit a blank page.
    defaultErrorComponent: ErrorRecovery,
  });

  return router;
};
