/**
 * WelcomeMessage.tsx
 * Component for displaying welcome messages and chat type selection
 */

import { Stack, Text, Card, Group, Button, Avatar, Flex } from "@mantine/core";
import { getAvatarUrl } from "@/utils/services/images";
import { memo } from "react";
import { ChatType } from "@/types";

interface WelcomeMessageProps {
    professor: {
        id: string;
        first_name: string;
        last_name: string;
    } | null;
    showButtons: boolean;
    followUp: boolean;
    activeChat: {
        chatType: ChatType;
    };
    colorScheme: string;
    onOptionClick: (type: ChatType) => void;
}

export const WelcomeMessage = memo(({ 
    professor, 
    showButtons, 
    followUp, 
    activeChat, 
    colorScheme,
    onOptionClick 
}: WelcomeMessageProps) => {
    if (!showButtons && !followUp) return null;

    return (
        <Stack>
            {showButtons && (
                <Flex gap="md" align="flex-start">
                    <Stack gap="xs" align="flex-start">
                        <Group gap="xs" align="center">
                            <Avatar
                                src={professor ? getAvatarUrl(professor.id) : undefined}
                                size="sm"
                                radius="xl"
                                alt="AI Assistant"
                            />
                            <Text size="sm" c="dimmed">
                                {professor ? `${professor.first_name} ${professor.last_name} (AI)` : 'AI Assistant'}
                            </Text>
                        </Group>

                        <Card
                            padding="sm"
                            radius="md"
                            style={{
                                backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                                minWidth: "200px",
                                maxWidth: "100%",
                                border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                            }}
                        >
                            <Stack gap="xs">
                                <Text>
                                    Hi! I'm your AI teaching assistant. How can I help you today?
                                </Text>
                                <Group>
                                    <Button
                                        variant="light"
                                        color="blue"
                                        onClick={() => onOptionClick('homework')}
                                    >
                                        Homework Help
                                    </Button>
                                    <Button
                                        variant="light"
                                        color="cyan"
                                        onClick={() => onOptionClick('conceptual')}
                                    >
                                        Conceptual Understanding
                                    </Button>
                                    <Button
                                        variant="light"
                                        color="teal"
                                        onClick={() => onOptionClick('review')}
                                    >
                                        Content Review
                                    </Button>
                                    <Button
                                        variant="light"
                                        color="violet"
                                        onClick={() => onOptionClick('summary')}
                                    >
                                        Summary
                                    </Button>
                                </Group>
                            </Stack>
                        </Card>
                    </Stack>
                </Flex>
            )}

            {followUp && (
                <Flex gap="md" align="flex-start">
                    <Stack gap="xs" align="flex-start">
                        <Group gap="xs" align="center">
                            <Avatar
                                src={professor ? getAvatarUrl(professor.id) : undefined}
                                size="sm"
                                radius="xl"
                                alt="AI Assistant"
                            />
                            <Text size="sm" c="dimmed">
                                {professor ? `${professor.first_name} ${professor.last_name} (AI)` : 'AI Assistant'}
                            </Text>
                        </Group>

                        <Card
                            padding="sm"
                            radius="md"
                            style={{
                                backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                                minWidth: "200px",
                                maxWidth: "100%",
                                border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                            }}
                        >
                            <Text>
                                Sounds good! I can definitely help you with{' '}
                                {activeChat.chatType === 'homework' ? (
                                    <Text span fw={600} c="blue">your homework</Text>
                                ) : activeChat.chatType === 'conceptual' ? (
                                    <Text span fw={600} c="cyan">understanding concepts</Text>
                                ) : activeChat.chatType === 'review' ? (
                                    <Text span fw={600} c="teal">reviewing the content</Text>
                                ) : (
                                    <Text span fw={600} c="violet">creating a summary</Text>
                                )}. What specific {activeChat.chatType === 'homework' ? 'problem' :
                                activeChat.chatType === 'conceptual' ? 'topic' :
                                'material'} would you like to go over?
                            </Text>
                        </Card>
                    </Stack>
                </Flex>
            )}
        </Stack>
    );
});

WelcomeMessage.displayName = 'WelcomeMessage';
