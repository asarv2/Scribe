/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, TextInput, Group, Stack, ScrollArea } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { LectureList } from "./LectureList";
import { TextbookTree } from "./TextbookTree";
import { ChatMessage } from "./ChatCanvas";

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
    return (
        <Stack>
            <Card
                shadow="sm"
                p="md"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    backgroundColor: 'white'
                }}
            >
                <TextInput
                    placeholder="Search context..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftSection={<IconSearch size={16} />}
                />
            </Card>

            <ScrollArea.Autosize mah={isMobile ? 400 : "calc(100vh - 250px)"}>
                <Stack gap={0}>
                    <LectureList
                        classId={classId}
                        searchQuery={searchQuery}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                        addContextToChat={addContextToChat}
                        activeChat={activeChat}
                    />

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
                </Stack>
            </ScrollArea.Autosize>
        </Stack>
    );
}


