/**
 * ContentList.tsx
 * A generic version of LectureList with drag-n-drop functionality
 * @AshokSaravanan222
 * 02/21/2025
 */

import { Card, Group, Text, Stack, Loader } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useMantineColorScheme } from '@mantine/core';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import React from "react";
import classes from './ContentList.module.css';
import { Lecture, Textbook, Chapter, Subchapter, Exercise, Homework, Problem, ChatMessage } from "@/types";
import Image from 'next/image';

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
}: ContentListProps<T>) {
    const { colorScheme } = useMantineColorScheme();

    if (!items.length) return null;

    return (
        <Card 
            p="md"
            style={{
                backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f8f9fa",
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`
            }}
        >
            <Group mb={expandedSections.has(sectionKey) ? "md" : 0}>
                <Group 
                    onClick={() => toggleSection(sectionKey)}
                    style={{ cursor: 'pointer' }}
                >
                    {expandedSections.has(sectionKey) ? (
                        <IconChevronDown size={16} />
                    ) : (
                        <IconChevronRight size={16} />
                    )}
                    <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "gray.8"}>
                        {title} {searchActive && `(${resultCount ?? items.length} results)`}
                    </Text>
                </Group>
                {isSearching && <Loader size="xs" />}
            </Group>

            {expandedSections.has(sectionKey) && (
                <div>
                    {items.filter(item => !activeContextIds.includes(item.id)).map((item, index) => (
                        <Draggable 
                            key={item.id}
                            draggableId={`${sectionKey}*${item.id}`}
                            index={index}
                            isDragDisabled={activeContextIds.includes(item.id)}
                        >
                            {(provided, snapshot) => (
                                <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    shadow="xs"
                                    p="xs"
                                    radius="md"
                                    withBorder
                                    className={snapshot.isDragging ? classes.itemDragging : ''}
                                    style={{
                                        ...provided.draggableProps.style,
                                        marginBottom: '8px',
                                        backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                                        borderColor: colorScheme === "dark" ? "#373A40" : "#e9ecef",
                                        opacity: activeContextIds.includes(item.id) ? 0.5 : 1,
                                        cursor: activeContextIds.includes(item.id) ? 'not-allowed' : 'grab'
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
                                            style={{ objectFit: 'cover', borderRadius: '4px' }}
                                        />
                                        <Stack style={{ flex: 1 }}>
                                            <Text size="sm" c={colorScheme === "dark" ? "gray.3" : "gray.7"}>
                                                {item.newName}
                                            </Text>
                                            {renderExtraContent && renderExtraContent(item)}
                                        </Stack>
                                    </Group>
                                </Card>
                            )}
                        </Draggable>
                    ))}
                </div>
            )}
        </Card>
    );
}

