/**
 * LeaveClassModal.tsx
 * Used to leave a class
 * @AshokSaravanan222
 * 2025-05-09
 */

import { Modal, Button, Text, Stack, Group, Tooltip, ActionIcon } from "@mantine/core";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconLogout } from "@tabler/icons-react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useDisclosure } from "@mantine/hooks";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { updateProfileClasses } from "@/utils/services/class";

interface LeaveClassModalProps {
  classId: string;
  className: string;
  onLeave?: () => void;
  buttonVariant?: string;
}

export default function LeaveClassModal({ 
  classId, 
  className, 
  onLeave, 
  buttonVariant = "light" 
}: LeaveClassModalProps) {
  const supabase = useSupabaseBrowser();
  const [opened, { open, close }] = useDisclosure(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(supabase),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(supabase, user!.id),
    enabled: !!user
  });

  const handleLeaveClass = async () => {
    setLeaveLoading(true);
    try {
      if (!profile) {
        throw new Error("Profile not found");
      }
      
      const { success, error } = await updateProfileClasses(
        user!.id, 
        profile.classes.filter((id) => id !== classId)
      );
      
      if (!success) {
        throw new Error(error);
      }
      
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      
      notifications.show({
        title: 'Success',
        message: 'You have left the class successfully',
        color: 'green'
      });
      
      if (onLeave) {
        onLeave();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLeaveLoading(false);
      close();
    }
  };

  return (
    <>
      <Button
        variant={buttonVariant as any}
        color="red"
        onClick={open}
        leftSection={<IconLogout size={16} />}
      >
        Leave
      </Button>
      
      <Modal
        opened={opened}
        onClose={close}
        title={`Leave ${className}`}
        size="md"
        centered
      >
        <Stack>
          <Text size="sm">
            Are you sure you want to leave this class? You may need to request access again if you want to rejoin.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={leaveLoading}
              onClick={handleLeaveClass}
            >
              Leave Class
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
