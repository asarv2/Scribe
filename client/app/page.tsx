/**
 * app/page.tsx
 * The root page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { HeaderSimple } from "../components/HeaderSimple";
import { Box, Text } from "@mantine/core";
import Link from "next/link";

export default function Landing() {
  return (
    <Box>
      <HeaderSimple />
      <Text>Scribe Landing Page</Text>
      <Link href="/home">Get Started</Link>
    </Box>
  );
}
