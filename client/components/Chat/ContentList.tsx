/**
 * ContentList.tsx
 * A generic version of LectureList with drag-n-drop functionality
 * @AshokSaravanan222
 * 02/21/2025
 */

import { Card, Group, Text, Stack, Skeleton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useMantineColorScheme } from '@mantine/core';
import React, { useState, useEffect } from "react";
import { Lecture, Textbook, Chapter, Subchapter, Exercise, Homework, Problem, ChatMessage } from "@/types";
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@tabler/icons-react';

// Add a function to calculate relevance score
function calculateRelevance(item: ContentItem, documents: any[], searchQuery: string): number {
    if (!searchQuery) return 0;
    
    const query = searchQuery.toLowerCase();
    let score = 0;
    
    // Title match has highest weight
    if (item.newName.toLowerCase().includes(query)) {
        score += 10;
    }
    
    // Check documents content
    const itemDocs = documents?.filter(doc => 
        doc.lecture === item.id || 
        doc.chapter === item.id ||
        doc.homework === item.id ||
        doc.exercise === item.id
    );

    itemDocs?.forEach(doc => {
        // Text content matches
        if (doc.text?.toLowerCase().includes(query)) {
            score += 5;
        }
        // Description matches
        if (doc.description?.toLowerCase().includes(query)) {
            score += 3;
        }
    });

    return score;
}

interface ContentItem {
    id: string;
    newName: string;
    imageUrl: string;
    relevanceScore?: number; // Add this new property
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
    color?: string;
    documents?: any[]; // Add this new prop
    searchQuery?: string; // Add this new prop
}

// Simple loading skeleton for the entire section
const SectionSkeleton = () => (
    <Stack mt="md">
        {[1, 2, 3].map((i) => (
            <Card key={i} shadow="xs" p="xs" radius="md" withBorder>
                <Group>
                    <Skeleton width={40} height={40} radius="md" />
                    <Stack style={{ flex: 1 }}>
                        <Skeleton height={12} width="60%" />
                        <Skeleton height={8} width="40%" />
                    </Stack>
                </Group>
            </Card>
        ))}
    </Stack>
);

export function ContentList<T extends ContentItem & (Lecture | Chapter | Exercise | Homework)>({
    title,
    sectionKey,
    items,
    isSearching,
    searchActive,
    resultCount,
    expandedSections,
    toggleSection,
    addContextToChat,
    contextType,
    activeContextIds,
    renderExtraContent,
    icon: IconComponent,
    color = 'blue',
    documents = [],
    searchQuery = "",
}: ContentListProps<T>) {
    const { colorScheme } = useMantineColorScheme();
    const parentRef = React.useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Available items for rendering
    const availableItems = items.filter(item => !activeContextIds.includes(item.id));

    // Sort items by relevance score
    const sortedItems = [...availableItems].sort((a, b) => {
        const scoreA = calculateRelevance(a, documents, searchQuery);
        const scoreB = calculateRelevance(b, documents, searchQuery);
        return scoreB - scoreA;
    });

    // Virtual list setup
    const rowVirtualizer = useVirtualizer({
        count: sortedItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 70,
        overscan: 5, // Render 5 items above and below viewport
    });

    // Simple loading simulation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [items]);

    if (!items.length) return null;

    const ItemCard = ({ item }: { item: T }) => {
        return (
            <Card
                shadow="xs"
                p="xs"
                radius="md"
                withBorder
                style={{
                    marginBottom: '8px',
                    backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    addContextToChat(contextType, item.id);
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
                        }}
                        priority
                    />
                    <Stack style={{ flex: 1 }}>
                        <Group justify="space-between">
                            <Text size="sm">
                                {item.newName}
                            </Text>
                        </Group>
                        {renderExtraContent?.(item)}
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
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`,
                borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
                userSelect: 'none',
                cursor: 'pointer', 
            }}
            onClick={() => toggleSection(sectionKey)}
        >
            {/* Section Header */}
            <Group 
                mb={expandedSections.has(sectionKey) ? "md" : 0} 
                justify="space-between" 
            >
                <Group gap="xs">
                    {IconComponent && <IconComponent size={16} />}
                    <Text fw={700}>
                        {title} {searchActive && `(${resultCount ?? items.length})`}
                    </Text>
                </Group>
                {expandedSections.has(sectionKey) ? (
                    <IconChevronDown size={16} />
                ) : (
                    <IconChevronRight size={16} />
                )}
            </Group>

            {/* Content Area */}
            {expandedSections.has(sectionKey) && (
                isLoading ? (
                    <SectionSkeleton />
                ) : (
                    <div
                        ref={parentRef}
                        style={{
                            maxHeight: '400px',
                            overflow: 'auto',
                            position: 'relative'
                        }}
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative'
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                                <div
                                    key={virtualRow.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <ItemCard item={sortedItems[virtualRow.index]} />
                                </div>
                            ))}
                        </div>
                    </div>
                )
            )}
        </Card>
    );
}
