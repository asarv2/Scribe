// utils/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Example stale time
      refetchOnWindowFocus: false,
    },
  },
});
