"use client";

// Add these imports
import { useDrop } from 'react-dnd';
import { useState, useCallback } from 'react';
import { Textarea, Button, Group, ActionIcon, Tooltip, Text, Stack, Badge, Flex } from '@mantine/core';
import { IconSend, IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { ChatMessage, ViewerMode } from '@/types';
import { useMediaQuery } from '@mantine/hooks';
import { em } from '@mantine/core';

interface ChatInputProps {
    activeChat: ChatMessage;
    loading: boolean;
    classId: string;
    onPromptChange: (prompt: string) => void;
    onSend: () => void;
    onRemoveContext: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    onScrollToSection: (sectionId: string) => void;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    onDrop?: (item: { id: string, type: string }) => void;
}

export function ChatInput({
    activeChat,
    loading,
    classId,
    onPromptChange,
    onSend,
    onRemoveContext,
    onScrollToSection,
    setViewerMode,
    expandedSections,
    toggleSection,
    onDrop
}: ChatInputProps) {
    const [inputValue, setInputValue] = useState(activeChat.prompt);
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
        onPromptChange(event.target.value);
    }, [onPromptChange]);

    const handleSend = useCallback(() => {
        onSend();
        setInputValue('');
    }, [onSend]);

    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CONTEXT_ITEM',
        drop: (item: { id: string, type: string }) => {
            if (onDrop) {
                onDrop(item);
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [onDrop]);

    return (
        <div ref={drop} style={{ 
            position: 'relative',
            width: '100%',
            padding: '0',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            border: isOver ? '2px dashed rgba(0, 120, 255, 0.5)' : '2px solid transparent',
            background: isOver ? 'rgba(0, 120, 255, 0.05)' : 'transparent'
        }}>
            {isOver && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '8px',
                    zIndex: 10,
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: 'rgba(0, 120, 255, 0.8)',
                    pointerEvents: 'none'
                }}>
                    Drop to add context
                </div>
            )}

            <Stack spacing="xs">
                <Textarea
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Type your message..."
                    minRows={3}
                    autosize
                    disabled={loading}
                />

                <Group position="right">
                    <Button
                        onClick={handleSend}
                        disabled={loading || !inputValue.trim()}
                        leftIcon={<IconSend size={16} />}
                    >
                        Send
                    </Button>
                </Group>
            </Stack>
        </div>
    );
}