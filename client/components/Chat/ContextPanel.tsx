/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, TextInput, Group, Stack, ScrollArea, useMantineColorScheme, Tooltip, ActionIcon } from "@mantine/core";
import { IconSearch, IconPresentation, IconBook } from "@tabler/icons-react";
import { LectureList } from "./LectureList";
import { TextbookTree } from "./TextbookTree";
import { ChatMessage } from "./ChatCanvas";
import { useState, useEffect } from "react";

interface ContextPanelProps {
    classId: string;
    isMobile: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    activeChat: ChatMessage;
}

export function ContextPanel({
    classId,
    isMobile,
    searchQuery,
    setSearchQuery,
    expandedSections,
    toggleSection,
    addContextToChat,
    expandedNodes,
    toggleNode,
    activeChat
}: ContextPanelProps) {
    const { colorScheme } = useMantineColorScheme();
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

    useEffect(() => {
        setLocalSearchQuery(searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSearchQuery(localSearchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [localSearchQuery, setSearchQuery]);

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <Stack>
            <TextInput
                placeholder="Search context..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                leftSection={<IconSearch size={16} />}
                styles={(theme) => ({
                    input: {
                        backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                        borderColor: colorScheme === "dark" ? "#373A40" : undefined
                    }
                })}
            />
            <Group>
                <Tooltip label="Jump to Lectures">
                    <ActionIcon
                        variant="subtle"
                        onClick={() => scrollToSection('lectures-section')}
                        aria-label="Jump to lectures"
                    >
                        <IconPresentation size={20} />
                    </ActionIcon>
                </Tooltip>
                <Tooltip label="Jump to Textbooks">
                    <ActionIcon
                        variant="subtle"
                        onClick={() => scrollToSection('textbooks-section')}
                        aria-label="Jump to textbooks"
                    >
                        <IconBook size={20} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            <ScrollArea.Autosize mah={isMobile ? 400 : "calc(100vh - 250px)"}>
                <Stack gap="xs">
                    <div id="lectures-section">
                        <LectureList
                            classId={classId}
                            searchQuery={searchQuery}
                            expandedSections={expandedSections}
                            toggleSection={toggleSection}
                            addContextToChat={addContextToChat}
                            activeChat={activeChat}
                        />
                    </div>

                    <div id="textbooks-section">
                        <TextbookTree
                            classId={classId}
                            searchQuery={searchQuery}
                            expandedSections={expandedSections}
                            toggleSection={toggleSection}
                            addContextToChat={addContextToChat}
                            expandedNodes={expandedNodes}
                            toggleNode={toggleNode}
                            activeChat={activeChat}
                        />
                    </div>
                </Stack>
            </ScrollArea.Autosize>
        </Stack>
    );
}


