import { createQueryClient } from '@/utils/react-query/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export const ReactQueryClientProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => createQueryClient()); // Use a single instance
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
