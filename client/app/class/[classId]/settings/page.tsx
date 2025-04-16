/**
 * app/settings/page.tsx
 * Settings page, where they can view all of the class files from onedrive.
 * @AshokSaravanan222
 * 04/05/2025
 */
"use client"
import { ClassLayout } from "@/components/Class/ClassLayout";
import { Container, Group, Text, Paper } from "@mantine/core";
import Management from "@/components/Account/Management";
import { use } from "react";

export default function SettingsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);

  return <ClassLayout classId={classId}>
    <Container fluid>
      <Group justify="space-between">
        <Text size="xl" fw={700}>Settings</Text>
      </Group>

      <Paper p="md" withBorder mt="md">
        <Management classId={classId} />
      </Paper>

      {/* <Paper p="md" withBorder mt="md">
        <Onedrive classId={classId} />
      </Paper> */}
    </Container>
  </ClassLayout>
}