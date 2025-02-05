/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, TextInput, Group, Stack, Text, ActionIcon, ScrollArea } from "@mantine/core";
import { IconSearch, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { LectureList } from "./LectureList";
import { TextbookTree } from "./TextbookTree";
import { ProblemCard } from "./GenerateCanvas";

interface ContextPanelProps {
    classId: string;
    isMobile: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    selectedProblemIds: Set<number>;
    addContextToProblem: (problemId: number, contextType: keyof ProblemCard['context'], contextId: string) => void;
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    problems: ProblemCard[];
}

export function ContextPanel({
    classId,
    isMobile,
    searchQuery,
    setSearchQuery,
    expandedSections,
    toggleSection,
    selectedProblemIds,
    addContextToProblem,
    expandedNodes,
    toggleNode,
    problems
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
                        selectedProblemIds={selectedProblemIds}
                        addContextToProblem={addContextToProblem}
                        problems={problems}
                    />

                    <TextbookTree
                        classId={classId}
                        searchQuery={searchQuery}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                        selectedProblemIds={selectedProblemIds}
                        addContextToProblem={addContextToProblem}
                        expandedNodes={expandedNodes}
                        toggleNode={toggleNode}
                        problems={problems}
                    />
                </Stack>
            </ScrollArea.Autosize>
        </Stack>
    );
}


