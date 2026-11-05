import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 2 * 60 * 1000,
      // Keep recently visited workspaces warm when users switch routes.
      // Live review queries override this with shorter freshness/polling policies.
      gcTime: 10 * 60 * 1000,
    },
  },
});
