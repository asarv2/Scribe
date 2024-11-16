// app/providers.tsx
'use client';

import { ReactQueryClientProvider } from "@/components/ReactQueryClientProvider";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ReactFlowProvider } from "@xyflow/react";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReactQueryClientProvider>
            <ReactFlowProvider>
                <MantineProvider>
                    <Notifications />
                    {children}
                </MantineProvider>
            </ReactFlowProvider>
        </ReactQueryClientProvider>
    );
}
