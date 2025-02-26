/**
 * ContentList.tsx
 * A generic version of LectureList with drag-n-drop functionality
 * @AshokSaravanan222
 * 02/21/2025
 */

import { Card, Group, Text, Stack, Loader } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useMantineColorScheme } from '@mantine/core';
import React, { useState } from "react";
import { Lecture, Textbook, Chapter, Subchapter, Exercise, Homework, Problem, ChatMessage } from "@/types";
import Image from 'next/image';
import { DragOverlay } from '@dnd-kit/core';
import { Icon } from '@tabler/icons-react';

interface ContentItem {
    id: string;
    newName: string;
    imageUrl: string;
}

interface ContentListProps<T extends ContentItem & (Lecture | Textbook | Chapter | Subchapter | Exercise | Homework | Problem)> {
    title: string;
    sectionKey: string;
    items: T[];
    isSearching?: boolean;
    searchActive?: boolean;
    resultCount?: number;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    contextType: keyof ChatMessage['context'];
    activeContextIds: string[];
    renderExtraContent?: (item: T) => React.ReactNode;
    icon?: Icon;
}

export function ContentList<T extends ContentItem & (Lecture | Textbook | Chapter | Subchapter | Exercise | Homework | Problem)>({
    title,
    sectionKey,
    items,
    isSearching = false,
    searchActive = false,
    resultCount,
    expandedSections,
    toggleSection,
    addContextToChat,
    contextType,
    activeContextIds,
    renderExtraContent,
    icon: IconComponent,
}: ContentListProps<T>) {
    const { colorScheme } = useMantineColorScheme();

    if (!items.length) return null;

    const ItemCard = ({ item, contextType }: { item: T, contextType: keyof ChatMessage['context'] }) => {
        const getGradientColors = () => {
            if (contextType === 'lectures') {
                return 'linear-gradient(45deg, #2563eb, #60a5fa)'; // blue gradient
            } else if (contextType === 'chapters') {
                return 'linear-gradient(45deg, #16a34a, #4ade80)'; // green gradient
            } else if (contextType === 'homeworks') {
                return 'linear-gradient(45deg, #ea580c, #fb923c)'; // orange gradient
            } else if (contextType === 'exercises') {
                return 'linear-gradient(45deg, #0d9488, #5eead4)'; // teal gradient
            }
            return '';
        };

        return (
            <Card
                shadow="xs"
                p="xs"
                radius="md"
                withBorder
                style={{
                    marginBottom: '8px',
                    backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                    borderColor: colorScheme === "dark" ? "#373A40" : "#e9ecef",
                    opacity: activeContextIds.includes(item.id) ? 0.5 : 1,
                    cursor: activeContextIds.includes(item.id) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': !activeContextIds.includes(item.id) ? {
                        background: getGradientColors(),
                        '& img': {
                            filter: 'brightness(1.1)',
                        },
                        '& p': {
                            color: 'white',
                        }
                    } : {}
                }}
                onClick={() => {
                    if (!activeContextIds.includes(item.id)) {
                        addContextToChat(contextType, item.id);
                    }
                }}
            >
                <Group>
                    <Image
                        src={item.imageUrl}
                        alt={item.newName}
                        width={40}
                        height={40}
                        style={{ 
                            objectFit: 'cover', 
                            borderRadius: '4px',
                            transition: 'filter 0.2s ease'
                        }}
                    />
                    <Stack style={{ flex: 1 }}>
                        <Text 
                            size="sm" 
                            c={colorScheme === "dark" ? "gray.3" : "gray.7"}
                            component="p"
                            style={{
                                transition: 'color 0.2s ease',
                            }}
                        >
                            {item.newName}
                        </Text>
                        {renderExtraContent && renderExtraContent(item)}
                    </Stack>
                </Group>
            </Card>
        );
    };

    return (
        <Card
            p="md"
            style={{
                backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f8f9fa",
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`
            }}
        >
            <Group 
                mb={expandedSections.has(sectionKey) ? "md" : 0} 
                justify="space-between" 
                onClick={() => toggleSection(sectionKey)}
                style={{ cursor: 'pointer' }}
            >
                <Group gap="xs">
                    {IconComponent && <IconComponent size={16} />}
                    <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "gray.8"}>
                        {title} {searchActive && `(${resultCount ?? items.length} results)`}
                    </Text>
                    {isSearching && <Loader size="xs" />}
                </Group>
                {expandedSections.has(sectionKey) ? (
                    <IconChevronDown size={16} />
                ) : (
                    <IconChevronRight size={16} />
                )}
            </Group>

            {expandedSections.has(sectionKey) && (
                <div>
                    {items
                        .filter(item => !activeContextIds.includes(item.id))
                        .map((item) => (
                            <ItemCard key={item.id} item={item} contextType={contextType} />
                        ))}
                </div>
            )}
        </Card>
    );
}

