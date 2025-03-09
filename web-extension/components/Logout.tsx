import { Button, Group, Text, Avatar, Tooltip } from "@mantine/core";
import { sendToBackground } from "@plasmohq/messaging";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type LogoutProps = {
    name: string;
    userId: string;
    logoutIcon: React.ReactNode;
    onLogout: () => void;
}

export default function Logout({ name, userId, logoutIcon, onLogout }: LogoutProps) {
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const handleLogout = async () => {
        setLoading(true);
        
        try {
            const response = await sendToBackground<{}, { success: boolean; error: string }>({
                name: "logout"
            });

            if (!response.success) {
                throw new Error(response.error || "Logout failed");
            }
            
            // Clear React Query cache
            queryClient.clear();
            
            // Call the callback to update parent component state
            onLogout();
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Generate avatar URL if userId is provided
    const avatarUrl = `${process.env.PLASMO_PUBLIC_STORAGE_URL}/profiles/${userId}.png`;

    return (
        <Group justify="space-between" align="center">
            <Group gap="xs">
                <Avatar
                    src={avatarUrl}
                    size="sm"
                    radius="xl"
                    color="blue"
                >
                    {name.charAt(0)}
                </Avatar>
                <Text fw={500} size="sm">{name}</Text>
            </Group>
            <Tooltip label="Logout">
                <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={handleLogout}
                    loading={loading}
                    p={4}
                >
                    {loading ? null : logoutIcon}
                </Button>
            </Tooltip>
        </Group>
    );
}
