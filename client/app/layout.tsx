/**
 * app/layout.tsx
 * The root layout component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { Metadata } from "next";
import { ReactQueryClientProvider } from '../components/ReactQueryClientProvider';

export const metadata: Metadata = {
  title: "Scribe",
  description: "The groundbreaking lecture summarization tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <ReactQueryClientProvider>
          <MantineProvider>
            <Notifications />
            {children}
          </MantineProvider>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}
