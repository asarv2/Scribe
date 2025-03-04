// providers.tsx
import { ReactQueryClientProvider } from "~/components/ReactQueryClientProvider";
import { MantineProvider } from "@mantine/core";
import { HealthCheck } from "~/components/HealthCheck";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';


const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryClientProvider>
                <MantineProvider defaultColorScheme="dark">
                    <HealthCheck />
                    {children}
                </MantineProvider>
            </ReactQueryClientProvider>
        </QueryClientProvider>
    );
}
