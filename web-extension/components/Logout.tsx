import { Button, Group, Text, Avatar, Tooltip } from "@mantine/core";
import { sendToBackground } from "@plasmohq/messaging";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type LogoutProps = {
    name: string;
    userId: string;
    logoutIcon: React.ReactNode;
}


export default function Logout({ name, userId, logoutIcon }: LogoutProps) {
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const handleLogout = async () => {
        setLoading(true);
        try {
            const { success, error } = await sendToBackground<{}, { success: boolean; error: string }>({
                name: "logout"
            });

            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["classes"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["lectures"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["textbooks"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["homeworks"]
                });
                
                
            }
        } catch (e) {
            console.error(e);
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
