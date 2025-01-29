// app/providers.tsx
'use client';

import { ReactQueryClientProvider } from "@/components/ReactQueryClientProvider";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ReactFlowProvider } from "@xyflow/react";
import { Analytics } from '@vercel/analytics/next';
import { HealthCheck } from "@/components/HealthCheck";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReactQueryClientProvider>
            <ReactFlowProvider>
                <MantineProvider>
                    <Notifications />
                    <HealthCheck />
                    <Analytics />
                    {children}
                </MantineProvider>
            </ReactFlowProvider>
        </ReactQueryClientProvider>
    );
}
