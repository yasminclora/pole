import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime          : 60_000,         // 1 min — cache frais
      gcTime             : 5 * 60_000,     // 5 min — cache mémoire
      retry              : 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
