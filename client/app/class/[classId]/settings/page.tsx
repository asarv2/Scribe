/**
 * app/settings/page.tsx
 * Settings page, where they can view all of the class files from onedrive.
 * @AshokSaravanan222
 * 04/05/2025
 */
"use client"
import { ClassLayout } from "@/components/Class/ClassLayout";
import { Container, Group, Text, Paper, Stack, Box, Divider } from "@mantine/core";
import Management from "@/components/Account/Management";
import { use } from "react";
import DeleteClassModal from "@/components/Delete/DeleteClassModal";
import Outcomes from "@/components/Account/Outcomes";
import AddOutcomeModal from "@/components/Account/AddOutcomeModal";

export default function SettingsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);

  return <ClassLayout classId={classId}>
    <Container fluid>
      <Stack>
        <Box>
          <Group justify="space-between">
            <Text size="xl" fw={700}>Settings</Text>
            <DeleteClassModal classId={classId} />
          </Group>


          <Management classId={classId} />

        </Box>

        <Box>
          <Group justify="space-between">
            <Text size="xl" fw={700}>Outcomes</Text>
            <AddOutcomeModal classId={classId} />
          </Group>

          <Outcomes classId={classId} />
        </Box>
      </Stack>
    </Container>
  </ClassLayout>
}