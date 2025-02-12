// app/providers.tsx
'use client';

import { ReactQueryClientProvider } from "@/components/ReactQueryClientProvider";
import { createTheme, MantineColorScheme, MantineProvider, MantineTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ReactFlowProvider } from "@xyflow/react";
import { Analytics } from '@vercel/analytics/next';
import { HealthCheck } from "@/components/HealthCheck";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryClientProvider>
                <ReactFlowProvider>
                    <MantineProvider defaultColorScheme="dark">
                        <Notifications />
                        <HealthCheck />
                        <Analytics />
                        {children}
                    </MantineProvider>
                </ReactFlowProvider>
            </ReactQueryClientProvider>
        </QueryClientProvider>
    );
}
