import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, TextInput, Textarea, Stack, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { createClass } from '@/utils/services/class';
import { updateProfile } from '@/utils/services/profile';
import { checkCode } from '@/utils/services/code';
import { Profile } from '@/types';

interface ForcedClassModalProps {
  isOpen: boolean;
  profile: Profile | undefined;
  studentMode: boolean;
}

export function ForcedClassModal({ isOpen, profile, studentMode }: ForcedClassModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [classCode, setClassCode] = useState('');
  const [newClassName, setNewClassName] = useState("");
  const [newClassCode, setNewClassCode] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddClass = async () => {
    if (!profile) {
      throw new Error("Profile not found");
    }

    if (!newClassName || !newClassCode) {
      notifications.show({
        title: 'Error',
        message: 'Class name and code are required',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const classId = await createClass(
        newClassName,
        newClassCode,
        newClassDescription
      );

      if (!classId) {
        throw new Error("Failed to create class");
      } else {
        // add class to profile if not admin
        if (!profile.admin) {
          const { success: profileSuccess, error: profileError } = await updateProfile(profile.id, {
            classes: Array.from(new Set([...profile.classes, classId]))
          });

          if (!profileSuccess) {
            throw new Error(profileError);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      notifications.show({
        title: 'Success',
        message: 'Class created successfully',
        color: 'green'
      });

      // push to class page
      router.push(`/class/${classId}`);

      // Reset form
      setNewClassName("");
      setNewClassCode("");
      setNewClassDescription("");
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async () => {
    if (!profile) {
      throw new Error("Profile not found");
    }

    if (!classCode) {
      notifications.show({
        title: 'Error',
        message: 'Class code is required',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const { success, error, code } = await checkCode(classCode);

      if (!success || !code) {
        throw new Error(error);
      } else {
        // add class to profile if not admin
        if (!profile.admin) {
          const { success: profileSuccess, error: profileError } = await updateProfile(profile.id, {
            classes: Array.from(new Set([...profile.classes, code.class]))
          });

          if (!profileSuccess) {
            throw new Error(profileError);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      notifications.show({
        title: 'Success',
        message: 'Class joined successfully',
        color: 'green'
      });

      // push to class page
      router.push(`/class/${code.class}/chat/new`);

      // Reset form
      setClassCode("");
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={() => {}} // Empty function to prevent closing
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={
        <Text size="xl" fw={700}>
          {profile && ((profile.professor || profile.admin) && !studentMode)
            ? "Add Your First Class"
            : "Join Your First Class"}
        </Text>
      }
      centered
      size="lg"
    >
      <Text mb="md" c="dimmed" size="sm">
        {profile && ((profile.professor || profile.admin) && !studentMode)
          ? "Create a class to get started with ScribeLec."
          : "Enter a class code to join your first class."}
      </Text>
      
      <Stack gap="md">
        {profile && ((profile.professor || profile.admin) && !studentMode) ? (
          <Stack gap="md">
            <Group grow>
              <TextInput
                label="Class Name"
                placeholder="Introduction to Computer Science"
                value={newClassName}
                onChange={(e) => setNewClassName(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Class Code"
                placeholder="CS101"
                value={newClassCode}
                onChange={(e) => setNewClassCode(e.currentTarget.value)}
                required
              />
            </Group>
            <Textarea
              label="Description"
              placeholder="A brief description of the class"
              value={newClassDescription}
              onChange={(e) => setNewClassDescription(e.currentTarget.value)}
              autosize
              minRows={3}
            />
            <Group justify="flex-end">
              <Button onClick={handleAddClass} loading={loading}>Add Class</Button>
            </Group>
          </Stack>
        ) : (
          <Stack>
            <TextInput
              label="Class Code"
              placeholder="XXXXX-XXXXX"
              value={classCode}
              onChange={(event) => {
                let value = event.currentTarget.value.toUpperCase();
                
                // Remove any non-alphanumeric characters except hyphen
                value = value.replace(/[^A-Z0-9-]/g, '');
                
                // Auto-insert hyphen after 5 characters if not present
                if (value.length > 5 && value.charAt(5) !== '-') {
                  value = value.slice(0, 5) + '-' + value.slice(5);
                }
                
                // Limit to 11 characters (5 + hyphen + 5)
                if (value.length > 11) {
                  value = value.slice(0, 11);
                }
                
                setClassCode(value);
              }}
            />
            <Group justify="flex-end">
              <Button onClick={handleJoinClass} loading={loading}>Join Class</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
