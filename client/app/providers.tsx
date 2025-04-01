// app/providers.tsx
'use client';

import { ReactQueryClientProvider } from "@/components/ReactQueryClientProvider";
import { createTheme, MantineColorScheme, MantineProvider, MantineTheme, defaultVariantColorsResolver, VariantColorsResolver, parseThemeColor, rgba, darken } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { HealthCheck } from "@/components/HealthCheck";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Custom variant color resolver that adds light-outline variant
const variantColorResolver: VariantColorsResolver = (input) => {
  const defaultResolvedColors = defaultVariantColorsResolver(input);
  const parsedColor = parseThemeColor({
    color: input.color || input.theme.primaryColor,
    theme: input.theme,
  });

  // Add new light-outline variant
  if (input.variant === 'light-outline') {
    // Get the light variant colors first
    const lightVariantColors = defaultVariantColorsResolver({
      ...input,
      variant: 'light'
    });
    
    // Return light variant colors but with a border that uses the same color as the text
    return {
      ...lightVariantColors,
      border: `1px solid var(--mantine-color-${parsedColor.color}-light-color)`,
    };
  }

  return defaultResolvedColors;
};

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryClientProvider>
                <MantineProvider 
                    theme={{ 
                        variantColorResolver,
                        // @ts-ignore
                        variantProps: {
                            'light-outline': { variant: 'light-outline' }
                        }
                    }}
                    defaultColorScheme="dark"
                >
                    <Notifications />
                    <HealthCheck />
                    {children}
                </MantineProvider>
            </ReactQueryClientProvider>
        </QueryClientProvider>
    );
}
