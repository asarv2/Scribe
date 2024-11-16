/**
 * app/layout.tsx
 * The root layout component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { ColorSchemeScript } from '@mantine/core';
import type { Metadata } from "next";
import { Providers } from './providers';

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
          <Providers>{children}</Providers>
      </body>
    </html>
  );
}
